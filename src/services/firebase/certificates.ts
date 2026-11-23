import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import {
  computeRegNoHash,
  computeStudentPortalKey,
  generateCertificateId,
  normalizeEnrollment,
  normalizePhone,
} from '@/src/schemas/validation';
import type {
  AdminUser,
  CertificateIndexEntry,
  CertificatePlacement,
  CertificateType,
  IssuedCertificate,
  Registration,
  StudentProfile,
} from '@/src/types/models';

export interface CertificateRecipientInput {
  studentUid: string;
  registrationId: string;
  registrationReference?: string;
  lookupKey?: string;
  studentPortalKey?: string;
  phone?: string;
  studentName: string;
  registrationNumber: string;
  branch: string;
  batch: string;
  year: string;
  teamName?: string;
}

export interface DistributeCertificatesPayload {
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  certificateType: CertificateType;
  placement: CertificatePlacement;
  certificateTitle: string;
  certificateNote: string;
  customImageUrl: string;
  recipients: CertificateRecipientInput[];
  linkedRegistrationsById?: Record<string, Registration>;
}

export async function listCertificatesForStudent(
  uid: string,
  registrationNumber?: string
): Promise<IssuedCertificate[]> {
  const resultsMap = new Map<string, IssuedCertificate>();

  // 1) Fetch certificates directly linked to student's Firebase UID
  try {
    const q = query(collection(db, 'issuedCertificates'), where('studentUid', '==', uid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      resultsMap.set(d.id, { id: d.id, ...(d.data() as Omit<IssuedCertificate, 'id'>) });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'issuedCertificates');
  }

  // 2) Also fetch certificates indexed by student's normalized Registration Number hash
  if (registrationNumber && registrationNumber.trim().length >= 2) {
    const cleanReg = normalizeEnrollment(registrationNumber);
    const regNoHash = await computeRegNoHash(cleanReg);
    const idxPath = `certificateIndexes/${regNoHash}/items`;
    try {
      const idxSnap = await getDocs(collection(db, 'certificateIndexes', regNoHash, 'items'));
      for (const d of idxSnap.docs) {
        const entry = d.data() as Omit<CertificateIndexEntry, 'id'>;
        if (!resultsMap.has(entry.certId)) {
          resultsMap.set(entry.certId, {
            id: entry.certId,
            eventId: entry.eventId,
            eventName: entry.eventName,
            gameId: entry.gameId,
            gameName: entry.gameName,
            studentUid: uid,
            registrationId: '',
            regNoHash: entry.regNoHash,
            studentName: entry.studentName,
            registrationNumber: entry.registrationNumber,
            branch: entry.branch,
            batch: entry.batch,
            year: entry.year,
            teamName: entry.teamName,
            certificateType: entry.certificateType,
            placement: entry.placement,
            certificateTitle: entry.certificateTitle,
            certificateNote: entry.certificateNote,
            customImageUrl: entry.customImageUrl,
            issuedBy: '',
            issuedByName: '',
            issuedAt: entry.issuedAt,
            updatedAt: entry.updatedAt,
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, idxPath);
    }
  }

  return Array.from(resultsMap.values()).sort(
    (a, b) => (b.issuedAt?.toMillis?.() ?? 0) - (a.issuedAt?.toMillis?.() ?? 0)
  );
}

export async function listAllCertificatesForAdmin(
  actor: AdminUser,
  eventIdFilter?: string
): Promise<IssuedCertificate[]> {
  const path = 'issuedCertificates';
  try {
    const colRef = collection(db, 'issuedCertificates');
    const q =
      eventIdFilter && eventIdFilter !== 'all'
        ? query(colRef, where('eventId', '==', eventIdFilter))
        : colRef;
    const snap = await getDocs(q);
    let list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<IssuedCertificate, 'id'>) }))
      .sort((a, b) => (b.issuedAt?.toMillis?.() ?? 0) - (a.issuedAt?.toMillis?.() ?? 0));

    if (actor.role !== 'super_admin') {
      list = list.filter((c) => actor.assignedEventIds.includes(c.eventId));
    }
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function buildRecipientFromRegistration(
  reg: Registration,
  profileByRegNo?: Map<string, StudentProfile>
): CertificateRecipientInput {
  const normReg = normalizeEnrollment(reg.participant.enrollmentNumber);
  const matchedProfile = profileByRegNo?.get(normReg);
  return {
    studentUid: reg.studentUid || matchedProfile?.uid || '',
    registrationId: reg.id,
    registrationReference: reg.registrationReference,
    lookupKey: reg.lookupKey,
    studentPortalKey: reg.studentPortalKey,
    phone: reg.participant.phone,
    studentName: reg.participant.fullName,
    registrationNumber: normReg,
    branch: reg.participant.branch,
    batch: reg.participant.batch || matchedProfile?.batch || '',
    year: reg.participant.year,
    teamName: reg.team?.teamName || '',
  };
}

export function buildRecipientFromStudentProfile(
  profile: StudentProfile
): CertificateRecipientInput {
  return {
    studentUid: profile.uid,
    registrationId: '',
    studentName: profile.fullName,
    registrationNumber: normalizeEnrollment(profile.registrationNumber),
    branch: profile.branch,
    batch: profile.batch,
    year: profile.year,
    teamName: '',
  };
}

export async function distributeCertificates(
  payload: DistributeCertificatesPayload,
  actor: AdminUser
): Promise<number> {
  const path = 'issuedCertificates';
  if (payload.recipients.length === 0) return 0;

  try {
    let issuedCount = 0;
    const chunkSize = 40;
    const defaultTitle =
      payload.certificateTitle.trim() ||
      (payload.certificateType === 'winner'
        ? payload.placement === 'runner_up'
          ? 'Certificate of Merit — Runner-Up'
          : payload.placement === 'third_place'
          ? 'Certificate of Merit — Third Place'
          : 'Certificate of Excellence — Winner'
        : payload.certificateType === 'selected'
        ? 'Certificate of Selection & Merit'
        : 'Certificate of Participation');

    const cleanTitle = defaultTitle.slice(0, 160);
    const cleanNote = payload.certificateNote.trim().slice(0, 400);
    const cleanCustomImg = payload.customImageUrl.trim().slice(0, 450000);

    for (let i = 0; i < payload.recipients.length; i += chunkSize) {
      const slice = payload.recipients.slice(i, i + chunkSize);

      // Check existing portal entries for linked registrations
      const prepared = await Promise.all(
        slice.map(async (recipient) => {
          const cleanRegNo = normalizeEnrollment(recipient.registrationNumber);
          const regNoHash = await computeRegNoHash(cleanRegNo);
          const certId = generateCertificateId(
            `${payload.eventId}_${cleanRegNo}`
          );

          let portalRef = null;
          let portalExists = false;
          let resolvedPortalKey = recipient.studentPortalKey || '';

          if (recipient.registrationId && recipient.lookupKey) {
            if (!resolvedPortalKey && recipient.phone) {
              resolvedPortalKey = await computeStudentPortalKey(
                cleanRegNo,
                normalizePhone(recipient.phone)
              );
            }
            if (resolvedPortalKey) {
              portalRef = doc(db, 'studentPortals', resolvedPortalKey, 'entries', recipient.registrationId);
              const snap = await getDoc(portalRef);
              portalExists = snap.exists();
            }
          }

          return {
            recipient,
            cleanRegNo,
            regNoHash,
            certId,
            portalRef,
            portalExists,
          };
        })
      );

      const batch = writeBatch(db);
      const nowTs = serverTimestamp();

      for (const item of prepared) {
        const { recipient, cleanRegNo, regNoHash, certId, portalRef, portalExists } = item;

        // 1) Primary issuedCertificates doc
        batch.set(doc(db, 'issuedCertificates', certId), {
          eventId: payload.eventId,
          eventName: payload.eventName.trim().slice(0, 140),
          gameId: payload.gameId || '',
          gameName: (payload.gameName || payload.eventName).trim().slice(0, 120),
          studentUid: recipient.studentUid || '',
          registrationId: recipient.registrationId || '',
          regNoHash,
          studentName: recipient.studentName.trim().slice(0, 120),
          registrationNumber: cleanRegNo.slice(0, 40),
          branch: recipient.branch.trim().slice(0, 80),
          batch: recipient.batch.trim().slice(0, 40),
          year: recipient.year.trim().slice(0, 30),
          teamName: (recipient.teamName || '').trim().slice(0, 120),
          certificateType: payload.certificateType,
          placement: payload.placement,
          certificateTitle: cleanTitle,
          certificateNote: cleanNote,
          customImageUrl: cleanCustomImg,
          issuedBy: actor.uid,
          issuedByName: actor.displayName.slice(0, 120),
          issuedAt: nowTs,
          updatedAt: nowTs,
        });

        // 2) SHA-256 registration number index entry for logged-in student retrieval
        batch.set(doc(db, 'certificateIndexes', regNoHash, 'items', certId), {
          certId,
          regNoHash,
          eventId: payload.eventId,
          eventName: payload.eventName.trim().slice(0, 140),
          gameId: payload.gameId || '',
          gameName: (payload.gameName || payload.eventName).trim().slice(0, 120),
          studentName: recipient.studentName.trim().slice(0, 120),
          registrationNumber: cleanRegNo.slice(0, 40),
          branch: recipient.branch.trim().slice(0, 80),
          batch: recipient.batch.trim().slice(0, 40),
          year: recipient.year.trim().slice(0, 30),
          teamName: (recipient.teamName || '').trim().slice(0, 120),
          certificateType: payload.certificateType,
          placement: payload.placement,
          certificateTitle: cleanTitle,
          certificateNote: cleanNote,
          customImageUrl: cleanCustomImg,
          issuedAt: nowTs,
          updatedAt: nowTs,
        });

        // 3) Sync registration + lookup + studentPortal when linked to a Registration record
        if (recipient.registrationId && recipient.lookupKey) {
          const certSync: Record<string, unknown> = {
            certificateIssued: true,
            certificateId: certId,
            certificateTitle: cleanTitle.slice(0, 160),
            certificateNote: cleanNote.slice(0, 300),
            certificateIssuedAt: Timestamp.now(),
            updatedAt: nowTs,
          };

          if (payload.placement === 'winner' || payload.placement === 'runner_up') {
            certSync.result = payload.placement;
          } else if (payload.placement === 'selected') {
            certSync.selectionStatus = 'selected';
          }

          batch.update(doc(db, 'registrations', recipient.registrationId), certSync);
          batch.update(doc(db, 'registrationLookups', recipient.lookupKey), certSync);
          if (portalRef && portalExists) {
            batch.update(portalRef, certSync);
          }
        }

        issuedCount += 1;
      }

      await batch.commit();
    }

    await writeAuditLog({
      actor,
      action: 'certificate.distribute',
      entityType: 'issuedCertificate',
      entityId: payload.eventId,
      summary: `Distributed ${issuedCount} "${payload.certificateType}" certificate(s) for ${payload.eventName}${
        payload.gameName ? ` (${payload.gameName})` : ''
      }`,
      metadata: {
        eventId: payload.eventId,
        gameId: payload.gameId,
        certificateType: payload.certificateType,
        count: issuedCount,
        hasCustomImage: Boolean(payload.customImageUrl.trim()),
      },
    });

    return issuedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function revokeIssuedCertificate(
  cert: IssuedCertificate,
  actor: AdminUser
): Promise<void> {
  const path = `issuedCertificates/${cert.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'issuedCertificates', cert.id));
    batch.delete(doc(db, 'certificateIndexes', cert.regNoHash, 'items', cert.id));
    await batch.commit();

    await writeAuditLog({
      actor,
      action: 'certificate.revoke',
      entityType: 'issuedCertificate',
      entityId: cert.id,
      summary: `Revoked certificate ${cert.id} for ${cert.studentName} (${cert.registrationNumber})`,
      metadata: { eventId: cert.eventId },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
