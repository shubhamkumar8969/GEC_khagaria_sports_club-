import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import {
  computeLookupKey,
  computeStudentPortalKey,
  generateCertificateId,
  generateId,
  generateRegistrationReference,
  normalizeEnrollment,
  normalizePhone,
  sanitizeId,
} from '@/src/schemas/validation';
import type {
  AdminUser,
  EventGame,
  MatchResult,
  MatchStatus,
  ParticipantInfo,
  Registration,
  RegistrationLookup,
  RegistrationStatus,
  SelectionStatus,
  SportEvent,
  StatusHistoryEntry,
  StudentPortalEntry,
  TeamInfo,
} from '@/src/types/models';

export interface SubmitRegistrationPayload {
  event: SportEvent;
  game: EventGame;
  participant: ParticipantInfo;
  team: TeamInfo;
  customAnswers: Record<string, string | number | boolean | string[]>;
  declarationAccepted: boolean;
  studentUid?: string;
}

export interface SubmitRegistrationResult {
  registrationId: string;
  registrationReference: string;
  registrationStatus: RegistrationStatus;
  enrollmentNumber: string;
  phoneNumber: string;
}

export async function submitRegistration(
  payload: SubmitRegistrationPayload
): Promise<SubmitRegistrationResult> {
  const { event, game, participant, team, customAnswers, declarationAccepted, studentUid } = payload;

  if (!declarationAccepted) {
    throw new Error('Please accept the registration declaration and privacy notice before submitting.');
  }

  const normalizedEnrollment = normalizeEnrollment(participant.enrollmentNumber);
  const normalizedPhone = normalizePhone(participant.phone);

  if (game.participationType !== 'individual') {
    const seen = new Set<string>();
    for (const member of team.members) {
      const mEnroll = member.enrollmentNumber.trim()
        ? normalizeEnrollment(member.enrollmentNumber)
        : '';
      if (!mEnroll) continue;
      if (seen.has(mEnroll)) {
        throw new Error(`Duplicate registration number detected inside the team: ${member.enrollmentNumber}`);
      }
      seen.add(mEnroll);
    }
  }

  const registrationId = generateId('reg');
  const registrationReference = generateRegistrationReference(event.slug);
  const lookupKey = await computeLookupKey(registrationReference, normalizedEnrollment);
  const studentPortalKey = await computeStudentPortalKey(normalizedEnrollment, normalizedPhone);
  const lockId = sanitizeId(`${event.id}__${game.id}__${normalizedEnrollment}`);
  const counterId = `${event.id}__${game.id}`;
  const initialStatus: RegistrationStatus = 'approved';

    const cleanParticipant: ParticipantInfo = {
      fullName: participant.fullName.trim().slice(0, 120),
      enrollmentNumber: normalizedEnrollment.slice(0, 40),
      branch: participant.branch.trim().slice(0, 80),
      ...(participant.batch?.trim() ? { batch: participant.batch.trim().slice(0, 40) } : {}),
      year: participant.year.trim().slice(0, 30),
      ...(participant.semester?.trim() ? { semester: participant.semester.trim().slice(0, 30) } : {}),
      phone: normalizedPhone.slice(0, 20),
      email: participant.email.trim().toLowerCase().slice(0, 200),
    };

    const cleanCustomAnswers: Record<string, string | number | boolean | string[]> = {};
    for (const [k, v] of Object.entries(customAnswers || {}).slice(0, 30)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        cleanCustomAnswers[k] = v.map((item) => String(item).slice(0, 200)).slice(0, 30);
      } else if (typeof v === 'string') {
        cleanCustomAnswers[k] = v.slice(0, 1000);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        cleanCustomAnswers[k] = v;
      }
    }

    const filteredMembers =
      game.participationType === 'individual'
        ? []
        : team.members
            .filter((m) => m.fullName.trim().length > 0 || m.enrollmentNumber.trim().length > 0)
            .slice(0, 30)
            .map((m) => ({
              fullName: m.fullName.trim().slice(0, 120),
              enrollmentNumber: m.enrollmentNumber.trim()
                ? normalizeEnrollment(m.enrollmentNumber).slice(0, 40)
                : '',
              branch: (m.branch || '').trim().slice(0, 80),
              year: (m.year || '').trim().slice(0, 30),
              roleLabel: (m.roleLabel || '').trim().slice(0, 40),
            }));

    const cleanTeam: TeamInfo =
      game.participationType === 'individual'
        ? { teamName: '', captainName: '', captainEnrollment: '', members: [] }
        : {
            teamName: (
              team.teamName.trim() ||
              (game.participationType === 'doubles'
                ? `${cleanParticipant.fullName} & ${filteredMembers[1]?.fullName || 'Partner'}`
                : `${cleanParticipant.fullName}'s Team`)
            ).slice(0, 120),
            captainName: cleanParticipant.fullName.slice(0, 120),
            captainEnrollment: normalizedEnrollment.slice(0, 40),
            members: filteredMembers,
          };

    const currentUid = auth.currentUser?.uid?.trim() || '';
    const resolvedStudentUid = (currentUid || studentUid || '').trim().slice(0, 128);
    if (!resolvedStudentUid || !auth.currentUser) {
      throw new Error('Please sign in with Google before submitting your registration.');
    }

    let activeOp: OperationType = OperationType.WRITE;
    let activePath = `registrations/${registrationId}`;

    try {
      const regRef = doc(db, 'registrations', registrationId);
      const lockRef = doc(db, 'registrationLocks', lockId);
      const counterRef = doc(db, 'gameCounters', counterId);
      const eventRef = doc(db, 'events', event.id);
      const gameRef = doc(db, 'events', event.id, 'games', game.id);

      const committedMeta = await runTransaction(db, async (tx) => {
        activeOp = OperationType.GET;
        activePath = `events/${event.id}`;
        const eventSnap = await tx.get(eventRef);

        activePath = `events/${event.id}/games/${game.id}`;
        const gameSnap = await tx.get(gameRef);

        activePath = `registrationLocks/${lockId}`;
        const lockSnap = await tx.get(lockRef);

        activePath = `gameCounters/${counterId}`;
        const counterSnap = await tx.get(counterRef);

        if (!eventSnap.exists()) {
          throw new Error('Selected event no longer exists.');
        }
        const liveEvent = eventSnap.data() as Omit<SportEvent, 'id'>;
        if (liveEvent.status !== 'registration_open') {
          throw new Error('Registration for this event is currently closed.');
        }

        if (!gameSnap.exists()) {
          throw new Error('Selected game no longer exists.');
        }
        const liveGame = gameSnap.data() as Omit<EventGame, 'id'>;
        if (liveGame.registrationStatus !== 'open') {
          throw new Error('Registration for this game has been closed.');
        }

        if (lockSnap.exists()) {
          throw new Error(
            `Enrollment number ${normalizedEnrollment} is already registered for ${liveGame.name} in ${liveEvent.name}.`
          );
        }

        const currentCount = counterSnap.exists() ? Number(counterSnap.data()?.count) || 0 : 0;
        const maxCapacity =
          liveGame.participationType === 'individual' ? liveGame.maxParticipants : liveGame.maxTeams;
        if (maxCapacity > 0 && currentCount >= maxCapacity) {
          throw new Error(`Registration capacity (${maxCapacity}) has been reached for ${liveGame.name}.`);
        }

        const nowTs = serverTimestamp();
        const safeEventName = (liveEvent.name || event.name).trim().slice(0, 140);
        const safeGameName = (liveGame.name || game.name).trim().slice(0, 120);

        activeOp = OperationType.WRITE;
        activePath = `registrations/${registrationId} (transaction with lock=${lockId}, counter=${counterId})`;

        tx.set(regRef, {
          eventId: event.id,
          eventName: safeEventName,
          gameId: game.id,
          gameName: safeGameName,
          participationType: liveGame.participationType,
          registrationReference,
          lookupKey,
          studentPortalKey,
          studentUid: resolvedStudentUid,
          participant: cleanParticipant,
          team: cleanTeam,
          customAnswers: cleanCustomAnswers,
          registrationStatus: initialStatus,
          selectionStatus: 'not_reviewed',
          teamAssignment: '',
          matchStatus: 'not_scheduled',
          result: 'no_result',
          certificateIssued: false,
          certificateId: '',
          certificateTitle: '',
          certificateNote: '',
          certificateIssuedAt: null,
          adminNotes: '',
          declarationAccepted: true,
          createdAt: nowTs,
          updatedAt: nowTs,
        });

        tx.set(lockRef, {
          eventId: event.id,
          gameId: game.id,
          registrationId,
          createdAt: nowTs,
        });

        tx.set(counterRef, {
          eventId: event.id,
          gameId: game.id,
          count: currentCount + 1,
          lastRegistrationId: registrationId,
          updatedAt: nowTs,
        });

        return {
          safeEventName,
          safeGameName,
          participationType: liveGame.participationType,
        };
      });

      // Sync lookup & studentPortal projections immediately after atomic transaction commits
      try {
        const supportBatch = writeBatch(db);
        const syncTs = serverTimestamp();

        supportBatch.set(doc(db, 'registrationLookups', lookupKey), {
          registrationId,
          registrationReference,
          eventId: event.id,
          eventName: committedMeta.safeEventName,
          gameId: game.id,
          gameName: committedMeta.safeGameName,
          participantName: cleanParticipant.fullName,
          enrollmentNumber: normalizedEnrollment.slice(0, 40),
          branch: cleanParticipant.branch,
          batch: cleanParticipant.batch || '',
          year: cleanParticipant.year,
          ...(cleanParticipant.semester ? { semester: cleanParticipant.semester } : {}),
          teamName: cleanTeam.teamName,
          participationType: committedMeta.participationType,
          registrationStatus: initialStatus,
          selectionStatus: 'not_reviewed',
          teamAssignment: '',
          matchStatus: 'not_scheduled',
          result: 'no_result',
          certificateIssued: false,
          certificateId: '',
          certificateTitle: '',
          certificateNote: '',
          certificateIssuedAt: null,
          createdAt: syncTs,
          updatedAt: syncTs,
        });

        supportBatch.set(doc(db, 'studentPortals', studentPortalKey, 'entries', registrationId), {
          portalKey: studentPortalKey,
          registrationId,
          registrationReference,
          eventId: event.id,
          eventName: committedMeta.safeEventName,
          gameId: game.id,
          gameName: committedMeta.safeGameName,
          participantName: cleanParticipant.fullName,
          enrollmentNumber: normalizedEnrollment.slice(0, 40),
          branch: cleanParticipant.branch,
          batch: cleanParticipant.batch || '',
          year: cleanParticipant.year,
          ...(cleanParticipant.semester ? { semester: cleanParticipant.semester } : {}),
          teamName: cleanTeam.teamName,
          participationType: committedMeta.participationType,
          registrationStatus: initialStatus,
          selectionStatus: 'not_reviewed',
          teamAssignment: '',
          matchStatus: 'not_scheduled',
          result: 'no_result',
          certificateIssued: false,
          certificateId: '',
          certificateTitle: '',
          certificateNote: '',
          certificateIssuedAt: null,
          createdAt: syncTs,
          updatedAt: syncTs,
        });

        await supportBatch.commit();
      } catch (syncErr) {
        console.warn('Supporting registration projection sync warning:', syncErr);
      }

      return {
        registrationId,
        registrationReference,
        registrationStatus: initialStatus,
        enrollmentNumber: normalizedEnrollment,
        phoneNumber: normalizedPhone,
      };
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : '';
      const msgLower = error instanceof Error ? error.message.toLowerCase() : '';
      const isPermissionOrFirestoreErr =
        code.includes('permission') ||
        code.includes('failed-precondition') ||
        msgLower.includes('permission') ||
        msgLower.includes('insufficient');

      if (!isPermissionOrFirestoreErr && error instanceof Error) {
        throw error;
      }
      handleFirestoreError(error, activeOp, activePath);
    }
  }

export async function lookupRegistration(
  reference: string,
  enrollmentNumber: string
): Promise<RegistrationLookup | null> {
  const cleanRef = reference.trim().toUpperCase();
  const cleanEnroll = normalizeEnrollment(enrollmentNumber);
  if (!cleanRef || !cleanEnroll) return null;
  const lookupKey = await computeLookupKey(cleanRef, cleanEnroll);
  const path = `registrationLookups/${lookupKey}`;
  try {
    const snap = await getDoc(doc(db, 'registrationLookups', lookupKey));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<RegistrationLookup, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function lookupStudentPortalEntries(
  enrollmentNumber: string,
  phone: string
): Promise<StudentPortalEntry[]> {
  const cleanEnroll = normalizeEnrollment(enrollmentNumber);
  const cleanPhone = normalizePhone(phone);
  if (!cleanEnroll || cleanPhone.length < 7) return [];
  const portalKey = await computeStudentPortalKey(cleanEnroll, cleanPhone);
  const path = `studentPortals/${portalKey}/entries`;
  try {
    const snap = await getDocs(collection(db, 'studentPortals', portalKey, 'entries'));
    const entries = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<StudentPortalEntry, 'id'>),
    }));
    entries.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return entries;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listRegistrationsForStudentUid(
  uid: string,
  enrollmentNumber?: string
): Promise<Registration[]> {
  const path = 'registrations';
  try {
    const resultsMap = new Map<string, Registration>();

    const q = query(
      collection(db, 'registrations'),
      where('studentUid', '==', uid),
      limit(100)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      resultsMap.set(d.id, { id: d.id, ...(d.data() as Omit<Registration, 'id'>) });
    }

    if (enrollmentNumber && enrollmentNumber.trim().length >= 2) {
      const cleanEnroll = normalizeEnrollment(enrollmentNumber);

      const qEnroll = query(
        collection(db, 'registrations'),
        where('participant.enrollmentNumber', '==', cleanEnroll),
        limit(100)
      );
      const snapEnroll = await getDocs(qEnroll);
      for (const d of snapEnroll.docs) {
        resultsMap.set(d.id, { id: d.id, ...(d.data() as Omit<Registration, 'id'>) });
      }

      const qTeam = query(
        collection(db, 'registrations'),
        where('participationType', 'in', ['doubles', 'team']),
        limit(200)
      );
      const snapTeam = await getDocs(qTeam);
      for (const d of snapTeam.docs) {
        const regData = d.data() as Registration;
        const members = regData.team?.members || [];
        const isMember = members.some(
          (m) => normalizeEnrollment(m.enrollmentNumber) === cleanEnroll
        );
        if (
          isMember ||
          normalizeEnrollment(regData.team?.captainEnrollment || '') === cleanEnroll
        ) {
          resultsMap.set(d.id, { id: d.id, ...(regData as Omit<Registration, 'id'>) });
        }
      }
    }

    return Array.from(resultsMap.values()).sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listRegistrationsForAdmin(
  actor: AdminUser,
  eventIdFilter?: string
): Promise<Registration[]> {
  const path = 'registrations';
  try {
    const colRef = collection(db, 'registrations');
    if (actor.role === 'super_admin') {
      const q = eventIdFilter
        ? query(colRef, where('eventId', '==', eventIdFilter), limit(500))
        : query(colRef, orderBy('createdAt', 'desc'), limit(500));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Registration, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    }

    if (actor.assignedEventIds.length === 0) {
      return [];
    }

    const allowedIds = eventIdFilter
      ? actor.assignedEventIds.includes(eventIdFilter)
        ? [eventIdFilter]
        : []
      : actor.assignedEventIds.slice(0, 30);

    if (allowedIds.length === 0) return [];

    const q = query(colRef, where('eventId', 'in', allowedIds), limit(500));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Registration, 'id'>) }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getRegistrationById(registrationId: string): Promise<Registration | null> {
  const path = `registrations/${registrationId}`;
  try {
    const snap = await getDoc(doc(db, 'registrations', registrationId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Registration, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getRegistrationStatusHistory(registrationId: string): Promise<StatusHistoryEntry[]> {
  const path = `registrations/${registrationId}/statusHistory`;
  try {
    const q = query(
      collection(db, 'registrations', registrationId, 'statusHistory'),
      orderBy('changedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StatusHistoryEntry, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

async function resolvePortalKeyForReg(reg: Registration): Promise<string> {
  if (reg.studentPortalKey && /^[a-f0-9]{64}$/.test(reg.studentPortalKey)) {
    return reg.studentPortalKey;
  }
  return computeStudentPortalKey(reg.participant.enrollmentNumber, reg.participant.phone);
}

function buildPortalEntryDoc(
  reg: Registration,
  portalKey: string,
  overrides: Record<string, unknown>,
  nowTs: ReturnType<typeof serverTimestamp>
): Record<string, unknown> {
  return {
    portalKey,
    registrationId: reg.id,
    registrationReference: reg.registrationReference,
    eventId: reg.eventId,
    eventName: reg.eventName,
    gameId: reg.gameId,
    gameName: reg.gameName,
    participantName: reg.participant.fullName,
    enrollmentNumber: reg.participant.enrollmentNumber,
    branch: reg.participant.branch,
    batch: reg.participant.batch || '',
    year: reg.participant.year,
    ...(reg.participant.semester ? { semester: reg.participant.semester } : {}),
    teamName: reg.team?.teamName || '',
    participationType: reg.participationType,
    registrationStatus: (overrides.registrationStatus as RegistrationStatus) ?? reg.registrationStatus,
    selectionStatus: (overrides.selectionStatus as SelectionStatus) ?? reg.selectionStatus,
    teamAssignment: (overrides.teamAssignment as string) ?? reg.teamAssignment,
    matchStatus: (overrides.matchStatus as MatchStatus) ?? reg.matchStatus,
    result: (overrides.result as MatchResult) ?? reg.result,
    certificateIssued:
      overrides.certificateIssued !== undefined
        ? Boolean(overrides.certificateIssued)
        : Boolean(reg.certificateIssued),
    certificateId:
      overrides.certificateId !== undefined
        ? String(overrides.certificateId)
        : reg.certificateId || '',
    certificateTitle:
      overrides.certificateTitle !== undefined
        ? String(overrides.certificateTitle)
        : reg.certificateTitle || '',
    certificateNote:
      overrides.certificateNote !== undefined
        ? String(overrides.certificateNote)
        : reg.certificateNote || '',
    certificateIssuedAt:
      overrides.certificateIssuedAt !== undefined
        ? overrides.certificateIssuedAt
        : reg.certificateIssuedAt ?? null,
    createdAt: nowTs,
    updatedAt: nowTs,
  };
}

export interface UpdateRegistrationFields {
  registrationStatus?: RegistrationStatus;
  selectionStatus?: SelectionStatus;
  teamAssignment?: string;
  matchStatus?: MatchStatus;
  result?: MatchResult;
  adminNotes?: string;
}

export async function updateRegistrationDetails(
  reg: Registration,
  updates: UpdateRegistrationFields,
  reason: string,
  actor: AdminUser
): Promise<void> {
  const path = `registrations/${reg.id}`;
  try {
    const portalKey = await resolvePortalKeyForReg(reg);
    const portalRef = doc(db, 'studentPortals', portalKey, 'entries', reg.id);
    const portalSnap = await getDoc(portalRef);

    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    const cleanUpdates: Record<string, unknown> = { updatedAt: nowTs };
    if (!reg.studentPortalKey) {
      cleanUpdates.studentPortalKey = portalKey;
    }
    const lookupUpdates: Record<string, unknown> = { updatedAt: nowTs };
    const portalUpdates: Record<string, unknown> = { updatedAt: nowTs };
    const historyRecords: Array<{ field: string; oldValue: string; newValue: string }> = [];

    const trackedFields: (keyof UpdateRegistrationFields)[] = [
      'registrationStatus',
      'selectionStatus',
      'teamAssignment',
      'matchStatus',
      'result',
    ];

    for (const key of trackedFields) {
      const nextVal = updates[key];
      if (nextVal !== undefined && nextVal !== reg[key]) {
        cleanUpdates[key] = nextVal;
        lookupUpdates[key] = nextVal;
        portalUpdates[key] = nextVal;
        historyRecords.push({
          field: key,
          oldValue: String(reg[key] || ''),
          newValue: String(nextVal),
        });
      }
    }

    if (updates.adminNotes !== undefined && updates.adminNotes !== reg.adminNotes) {
      cleanUpdates.adminNotes = updates.adminNotes.trim().slice(0, 2000);
      historyRecords.push({
        field: 'adminNotes',
        oldValue: reg.adminNotes ? 'Updated previous note' : 'Empty',
        newValue: 'Note updated',
      });
    }

    if (historyRecords.length === 0) return;

    batch.update(doc(db, 'registrations', reg.id), cleanUpdates);
    if (Object.keys(lookupUpdates).length > 1) {
      batch.update(doc(db, 'registrationLookups', reg.lookupKey), lookupUpdates);
    }

    if (portalSnap.exists()) {
      if (Object.keys(portalUpdates).length > 1) {
        batch.update(portalRef, portalUpdates);
      }
    } else {
      batch.set(portalRef, buildPortalEntryDoc(reg, portalKey, cleanUpdates, nowTs));
    }

    for (const item of historyRecords) {
      const histId = generateId('hist');
      batch.set(doc(db, 'registrations', reg.id, 'statusHistory', histId), {
        field: item.field,
        oldValue: item.oldValue,
        newValue: item.newValue,
        changedBy: actor.uid,
        changedByName: actor.displayName,
        reason: reason.trim().slice(0, 500),
        changedAt: nowTs,
      });
    }

    await batch.commit();

    await writeAuditLog({
      actor,
      action: 'registration.update',
      entityType: 'registration',
      entityId: reg.id,
      summary: `Updated ${reg.registrationReference} (${reg.participant.fullName}): ${historyRecords
        .map((h) => `${h.field} ${h.oldValue} -> ${h.newValue}`)
        .join(', ')}`,
      metadata: {
        eventId: reg.eventId,
        gameId: reg.gameId,
        reference: reg.registrationReference,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function issueOrUpdateCertificate(
  reg: Registration,
  options: {
    issued: boolean;
    certificateTitle: string;
    certificateNote: string;
  },
  actor: AdminUser
): Promise<string> {
  const path = `registrations/${reg.id}`;
  try {
    const portalKey = await resolvePortalKeyForReg(reg);
    const portalRef = doc(db, 'studentPortals', portalKey, 'entries', reg.id);
    const portalSnap = await getDoc(portalRef);

    const nextCertificateId = options.issued
      ? reg.certificateId || generateCertificateId(reg.registrationReference)
      : reg.certificateId || '';

    const defaultTitle =
      reg.result === 'winner'
        ? 'Certificate of Excellence — Winner'
        : reg.result === 'runner_up'
        ? 'Certificate of Merit — Runner-Up'
        : 'Certificate of Participation';

    const cleanTitle = (options.certificateTitle.trim() || defaultTitle).slice(0, 160);
    const cleanNote = options.certificateNote.trim().slice(0, 300);
    const nowTs = serverTimestamp();
    const issuedAtVal = options.issued ? reg.certificateIssuedAt || Timestamp.now() : null;

    const certUpdates: Record<string, unknown> = {
      certificateIssued: options.issued,
      certificateId: nextCertificateId,
      certificateTitle: cleanTitle,
      certificateNote: cleanNote,
      certificateIssuedAt: issuedAtVal,
      updatedAt: nowTs,
    };

    const regUpdates: Record<string, unknown> = {
      ...certUpdates,
      ...(reg.studentPortalKey ? {} : { studentPortalKey: portalKey }),
    };

    const batch = writeBatch(db);
    batch.update(doc(db, 'registrations', reg.id), regUpdates);
    batch.update(doc(db, 'registrationLookups', reg.lookupKey), certUpdates);

    if (portalSnap.exists()) {
      batch.update(portalRef, certUpdates);
    } else {
      batch.set(portalRef, buildPortalEntryDoc(reg, portalKey, certUpdates, nowTs));
    }

    const histId = generateId('hist');
    batch.set(doc(db, 'registrations', reg.id, 'statusHistory', histId), {
      field: 'certificateIssued',
      oldValue: reg.certificateIssued ? 'issued' : 'not_issued',
      newValue: options.issued ? `issued (${nextCertificateId})` : 'revoked',
      changedBy: actor.uid,
      changedByName: actor.displayName,
      reason: cleanTitle,
      changedAt: nowTs,
    });

    await batch.commit();

    await writeAuditLog({
      actor,
      action: options.issued ? 'certificate.issue' : 'certificate.revoke',
      entityType: 'registration',
      entityId: reg.id,
      summary: `${options.issued ? 'Issued' : 'Revoked'} certificate ${nextCertificateId} for ${reg.participant.fullName} (${reg.gameName})`,
      metadata: {
        eventId: reg.eventId,
        gameId: reg.gameId,
        certificateId: nextCertificateId,
      },
    });

    return nextCertificateId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function bulkIssueCertificates(
  registrations: Registration[],
  options: {
    issued: boolean;
    certificateTitle?: string;
    certificateNote: string;
  },
  actor: AdminUser
): Promise<number> {
  const path = 'registrations';
  try {
    let updatedCount = 0;
    const chunkSize = 50; // Check portal existence + up to 4 writes per item
    for (let i = 0; i < registrations.length; i += chunkSize) {
      const slice = registrations.slice(i, i + chunkSize);
      const portalSnaps = await Promise.all(
        slice.map(async (r) => {
          const portalKey = await resolvePortalKeyForReg(r);
          const ref = doc(db, 'studentPortals', portalKey, 'entries', r.id);
          const snap = await getDoc(ref);
          return { reg: r, portalKey, ref, exists: snap.exists() };
        })
      );

      const batch = writeBatch(db);
      const nowTs = serverTimestamp();
      let batchCount = 0;

      for (const item of portalSnaps) {
        const { reg, portalKey, ref, exists } = item;
        if (actor.role !== 'super_admin' && !actor.assignedEventIds.includes(reg.eventId)) {
          continue;
        }

        const nextCertId = options.issued
          ? reg.certificateId || generateCertificateId(reg.registrationReference)
          : reg.certificateId || '';
        const autoTitle =
          reg.result === 'winner'
            ? 'Certificate of Excellence — Winner'
            : reg.result === 'runner_up'
            ? 'Certificate of Merit — Runner-Up'
            : 'Certificate of Participation';
        const finalTitle = (options.certificateTitle?.trim() || autoTitle).slice(0, 160);
        const cleanNote = options.certificateNote.trim().slice(0, 300);
        const issuedAtVal = options.issued ? reg.certificateIssuedAt || Timestamp.now() : null;

        const certUpdates: Record<string, unknown> = {
          certificateIssued: options.issued,
          certificateId: nextCertId,
          certificateTitle: finalTitle,
          certificateNote: cleanNote,
          certificateIssuedAt: issuedAtVal,
          updatedAt: nowTs,
        };

        batch.update(doc(db, 'registrations', reg.id), {
          ...certUpdates,
          ...(reg.studentPortalKey ? {} : { studentPortalKey: portalKey }),
        });
        batch.update(doc(db, 'registrationLookups', reg.lookupKey), certUpdates);
        if (exists) {
          batch.update(ref, certUpdates);
        } else {
          batch.set(ref, buildPortalEntryDoc(reg, portalKey, certUpdates, nowTs));
        }

        const histId = generateId('hist');
        batch.set(doc(db, 'registrations', reg.id, 'statusHistory', histId), {
          field: 'certificateIssued',
          oldValue: reg.certificateIssued ? 'issued' : 'not_issued',
          newValue: options.issued ? `issued (${nextCertId})` : 'revoked',
          changedBy: actor.uid,
          changedByName: actor.displayName,
          reason: finalTitle,
          changedAt: nowTs,
        });

        batchCount += 1;
        updatedCount += 1;
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }

    if (updatedCount > 0) {
      await writeAuditLog({
        actor,
        action: options.issued ? 'certificate.bulk_issue' : 'certificate.bulk_revoke',
        entityType: 'registration',
        entityId: 'bulk',
        summary: `${options.issued ? 'Issued' : 'Revoked'} certificates for ${updatedCount} registration(s)`,
        metadata: { count: updatedCount, issued: options.issued },
      });
    }

    return updatedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function bulkUpdateRegistrationStatus(
  registrations: Registration[],
  nextStatus: RegistrationStatus,
  reason: string,
  actor: AdminUser
): Promise<number> {
  const path = 'registrations';
  try {
    let updatedCount = 0;
    const chunkSize = 50;
    for (let i = 0; i < registrations.length; i += chunkSize) {
      const slice = registrations.slice(i, i + chunkSize);
      const portalChecks = await Promise.all(
        slice.map(async (r) => {
          const portalKey = await resolvePortalKeyForReg(r);
          const ref = doc(db, 'studentPortals', portalKey, 'entries', r.id);
          const snap = await getDoc(ref);
          return { reg: r, portalKey, ref, exists: snap.exists() };
        })
      );

      const batch = writeBatch(db);
      const nowTs = serverTimestamp();
      let batchCount = 0;

      for (const { reg, portalKey, ref, exists } of portalChecks) {
        if (reg.registrationStatus === nextStatus) continue;
        if (actor.role !== 'super_admin' && !actor.assignedEventIds.includes(reg.eventId)) {
          continue;
        }
        batch.update(doc(db, 'registrations', reg.id), {
          registrationStatus: nextStatus,
          ...(reg.studentPortalKey ? {} : { studentPortalKey: portalKey }),
          updatedAt: nowTs,
        });
        batch.update(doc(db, 'registrationLookups', reg.lookupKey), {
          registrationStatus: nextStatus,
          updatedAt: nowTs,
        });
        if (exists) {
          batch.update(ref, {
            registrationStatus: nextStatus,
            updatedAt: nowTs,
          });
        } else {
          batch.set(ref, buildPortalEntryDoc(reg, portalKey, { registrationStatus: nextStatus }, nowTs));
        }

        const histId = generateId('hist');
        batch.set(doc(db, 'registrations', reg.id, 'statusHistory', histId), {
          field: 'registrationStatus',
          oldValue: reg.registrationStatus,
          newValue: nextStatus,
          changedBy: actor.uid,
          changedByName: actor.displayName,
          reason: reason.trim().slice(0, 500) || 'Bulk status update',
          changedAt: nowTs,
        });
        batchCount += 1;
        updatedCount += 1;
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }

    if (updatedCount > 0) {
      await writeAuditLog({
        actor,
        action: 'registration.bulk_status_update',
        entityType: 'registration',
        entityId: 'bulk',
        summary: `Bulk updated ${updatedCount} registrations to "${nextStatus}"`,
        metadata: {
          count: updatedCount,
          nextStatus,
        },
      });
    }
    return updatedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function releaseDuplicateLock(
  reg: Registration,
  actor: AdminUser
): Promise<void> {
  const lockId = sanitizeId(`${reg.eventId}__${reg.gameId}__${normalizeEnrollment(reg.participant.enrollmentNumber)}`);
  const path = `registrationLocks/${lockId}`;
  try {
    await deleteDoc(doc(db, 'registrationLocks', lockId));
    await writeAuditLog({
      actor,
      action: 'registration.release_lock',
      entityType: 'registration',
      entityId: reg.id,
      summary: `Released duplicate lock for ${reg.participant.enrollmentNumber} in ${reg.gameName}`,
      metadata: { eventId: reg.eventId, gameId: reg.gameId },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
