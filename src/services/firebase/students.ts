import type { User } from 'firebase/auth';
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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import {
  computeRegNoHash,
  generateId,
  normalizeEnrollment,
  normalizePhone,
  sanitizeId,
} from '@/src/schemas/validation';
import type {
  AdminUser,
  Registration,
  StudentAccount,
  StudentActivity,
  StudentActivityAction,
  StudentProfile,
} from '@/src/types/models';

export async function getStudentProfile(uid: string): Promise<StudentProfile | null> {
  const path = `studentProfiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'studentProfiles', uid));
    if (!snap.exists()) return null;
    return snap.data() as StudentProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getStudentAccount(uid: string): Promise<StudentAccount | null> {
  const path = `studentAccounts/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'studentAccounts', uid));
    if (!snap.exists()) return null;
    return snap.data() as StudentAccount;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncStudentAccountOnLogin(params: {
  user: User;
  profile?: StudentProfile | null;
  incrementLogin?: boolean;
}): Promise<StudentAccount | null> {
  const { user, profile, incrementLogin = false } = params;
  if (!user.email || !user.emailVerified) return null;

  const path = `studentAccounts/${user.uid}`;
  const ref = doc(db, 'studentAccounts', user.uid);
  const cleanEmail = user.email.trim().toLowerCase().slice(0, 200);
  const resolvedName = (profile?.fullName || user.displayName || cleanEmail.split('@')[0] || 'Student')
    .trim()
    .slice(0, 120);
  const photoUrl = (user.photoURL || '').trim().slice(0, 1000);

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      const nowTs = serverTimestamp();
      await setDoc(ref, {
        uid: user.uid,
        email: cleanEmail,
        displayName: resolvedName,
        photoUrl,
        profileCompleted: Boolean(profile),
        fullName: (profile?.fullName || '').trim().slice(0, 120),
        registrationNumber: (profile?.registrationNumber || '').trim().slice(0, 40),
        branch: (profile?.branch || '').trim().slice(0, 80),
        year: (profile?.year || '').trim().slice(0, 30),
        semester: (profile?.semester || '').trim().slice(0, 30),
        phone: (profile?.phone || '').trim().slice(0, 20),
        status: 'active',
        blockedReason: '',
        blockedBy: '',
        blockedByName: '',
        blockedAt: null,
        loginCount: 1,
        lastLoginAt: nowTs,
        lastActiveAt: nowTs,
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      const createdSnap = await getDoc(ref);
      return createdSnap.exists() ? (createdSnap.data() as StudentAccount) : null;
    }

    const existing = existingSnap.data() as StudentAccount;
    if (existing.status === 'blocked') {
      return existing;
    }

    const nowTs = serverTimestamp();
    await updateDoc(ref, {
      displayName: (user.displayName || profile?.fullName || existing.displayName || resolvedName)
        .trim()
        .slice(0, 120),
      photoUrl: photoUrl || existing.photoUrl || '',
      profileCompleted: Boolean(profile) || existing.profileCompleted,
      fullName: (profile?.fullName || existing.fullName || '').trim().slice(0, 120),
      registrationNumber: (profile?.registrationNumber || existing.registrationNumber || '')
        .trim()
        .slice(0, 40),
      branch: (profile?.branch || existing.branch || '').trim().slice(0, 80),
      year: (profile?.year || existing.year || '').trim().slice(0, 30),
      semester: (profile?.semester || existing.semester || '').trim().slice(0, 30),
      phone: (profile?.phone || existing.phone || '').trim().slice(0, 20),
      loginCount: incrementLogin ? (existing.loginCount || 1) + 1 : existing.loginCount || 1,
      lastLoginAt: incrementLogin ? nowTs : existing.lastLoginAt,
      lastActiveAt: nowTs,
      updatedAt: nowTs,
    });

    const refreshed = await getDoc(ref);
    return refreshed.exists() ? (refreshed.data() as StudentAccount) : existing;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface SaveStudentProfileInput {
  fullName: string;
  registrationNumber: string;
  branch: string;
  batch?: string;
  year: string;
  semester?: string;
  phone: string;
}

export async function ensureEnrollmentLockForProfile(profile: StudentProfile): Promise<void> {
  if (!profile.uid || !profile.regNoHash || !/^[a-f0-9]{64}$/.test(profile.regNoHash)) {
    return;
  }
  try {
    const lockRef = doc(db, 'enrollmentLocks', profile.regNoHash);
    const snap = await getDoc(lockRef);
    if (!snap.exists()) {
      const nowTs = serverTimestamp();
      await setDoc(lockRef, {
        regNoHash: profile.regNoHash,
        uid: profile.uid,
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    }
  } catch {
    // Non-fatal backfill for legacy student profiles
  }
}

export async function saveStudentProfile(
  uid: string,
  email: string,
  input: SaveStudentProfileInput
): Promise<StudentProfile> {
  const path = `studentProfiles/${uid}`;
  const normalizedReg = normalizeEnrollment(input.registrationNumber);
  const regNoHash = await computeRegNoHash(normalizedReg);
  const cleanPhone = input.phone.trim() ? normalizePhone(input.phone) : '';
  const cleanEmail = email.trim().toLowerCase();
  const cleanBatch = (input.batch || '').trim().slice(0, 40);
  const cleanFullName = input.fullName.trim().slice(0, 120);
  const cleanBranch = input.branch.trim().slice(0, 80);
  const cleanYear = input.year.trim().slice(0, 30);
  const cleanSemester = (input.semester || '').trim().slice(0, 30);

  let activePath = path;

  try {
    const profileRef = doc(db, 'studentProfiles', uid);
    const nextLockRef = doc(db, 'enrollmentLocks', regNoHash);

    await runTransaction(db, async (tx) => {
      activePath = path;
      const existingSnap = await tx.get(profileRef);

      activePath = `enrollmentLocks/${regNoHash}`;
      const nextLockSnap = await tx.get(nextLockRef);

      const existingData = existingSnap.exists()
        ? (existingSnap.data() as StudentProfile)
        : null;

      let oldLockSnap = null;
      const oldRegNoHash =
        existingData?.regNoHash && existingData.regNoHash !== regNoHash
          ? existingData.regNoHash
          : null;
      const oldLockRef = oldRegNoHash ? doc(db, 'enrollmentLocks', oldRegNoHash) : null;
      if (oldLockRef) {
        oldLockSnap = await tx.get(oldLockRef);
      }

      if (nextLockSnap.exists() && nextLockSnap.data()?.uid !== uid) {
        throw new Error(
          `Enrollment number ${normalizedReg} is already registered to another Google student account.`
        );
      }

      const nowTs = serverTimestamp();

      // Write enrollment lock first in batch buffer (rules enforce UID ownership & uniqueness)
      if (!nextLockSnap.exists()) {
        tx.set(nextLockRef, {
          regNoHash,
          uid,
          createdAt: nowTs,
          updatedAt: nowTs,
        });
      } else {
        tx.update(nextLockRef, {
          updatedAt: nowTs,
        });
      }

      if (oldLockRef && oldLockSnap?.exists() && oldLockSnap.data()?.uid === uid) {
        tx.delete(oldLockRef);
      }

      activePath = path;
      if (!existingData) {
        tx.set(profileRef, {
          uid,
          fullName: cleanFullName,
          registrationNumber: normalizedReg.slice(0, 40),
          regNoHash,
          branch: cleanBranch,
          batch: cleanBatch,
          year: cleanYear,
          ...(cleanSemester ? { semester: cleanSemester } : {}),
          phone: cleanPhone.slice(0, 20),
          email: cleanEmail.slice(0, 200),
          createdAt: nowTs,
          updatedAt: nowTs,
        });
      } else {
        tx.update(profileRef, {
          fullName: cleanFullName,
          registrationNumber: normalizedReg.slice(0, 40),
          regNoHash,
          branch: cleanBranch,
          batch: cleanBatch,
          year: cleanYear,
          ...(cleanSemester ? { semester: cleanSemester } : {}),
          phone: cleanPhone.slice(0, 20),
          updatedAt: nowTs,
        });
      }
    });

    // Keep studentAccounts snapshot synced if present
    try {
      const acctRef = doc(db, 'studentAccounts', uid);
      const acctSnap = await getDoc(acctRef);
      if (acctSnap.exists()) {
        const acct = acctSnap.data() as StudentAccount;
        if (acct.status === 'active') {
          await updateDoc(acctRef, {
            displayName: cleanFullName,
            profileCompleted: true,
            fullName: cleanFullName,
            registrationNumber: normalizedReg.slice(0, 40),
            branch: cleanBranch,
            year: cleanYear,
            ...(cleanSemester ? { semester: cleanSemester } : {}),
            phone: cleanPhone.slice(0, 20),
            lastActiveAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch {
      // Non-fatal sync
    }

    const saved = await getDoc(profileRef);
    if (!saved.exists()) {
      throw new Error('Could not verify saved student profile.');
    }
    return saved.data() as StudentProfile;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
    if (error instanceof Error && !code.includes('permission') && !error.message.toLowerCase().includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, activePath);
  }
}

export async function logStudentActivity(params: {
  uid: string;
  email: string;
  studentName?: string;
  registrationNumber?: string;
  action: StudentActivityAction;
  summary: string;
  path?: string;
  eventId?: string;
  gameId?: string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<void> {
  if (!params.uid || !params.email) return;
  const activityId = generateId('act');
  try {
    const cleanMeta: Record<string, string | number | boolean> = {};
    if (params.metadata) {
      for (const [k, v] of Object.entries(params.metadata).slice(0, 15)) {
        if (typeof v === 'string') {
          cleanMeta[k.slice(0, 40)] = v.slice(0, 160);
        } else if (typeof v === 'number' || typeof v === 'boolean') {
          cleanMeta[k.slice(0, 40)] = v;
        }
      }
    }

    await setDoc(doc(db, 'studentActivity', activityId), {
      uid: params.uid.slice(0, 128),
      email: params.email.trim().toLowerCase().slice(0, 200),
      studentName: (params.studentName || '').trim().slice(0, 120),
      registrationNumber: (params.registrationNumber || '').trim().slice(0, 40),
      action: params.action,
      summary: params.summary.trim().slice(0, 500) || params.action,
      path: (params.path || '').trim().slice(0, 300),
      eventId: (params.eventId || '').trim().slice(0, 128),
      gameId: (params.gameId || '').trim().slice(0, 128),
      metadata: cleanMeta,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Activity telemetry must never block normal user flows
  }
}

export async function listAllStudentProfilesForAdmin(): Promise<StudentProfile[]> {
  const path = 'studentProfiles';
  try {
    const snap = await getDocs(collection(db, 'studentProfiles'));
    return snap.docs
      .map((d) => d.data() as StudentProfile)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAllStudentAccountsForAdmin(): Promise<StudentAccount[]> {
  const path = 'studentAccounts';
  try {
    const snap = await getDocs(collection(db, 'studentAccounts'));
    return snap.docs
      .map((d) => d.data() as StudentAccount)
      .sort(
        (a, b) =>
          (b.lastActiveAt?.toMillis?.() ?? b.lastLoginAt?.toMillis?.() ?? 0) -
          (a.lastActiveAt?.toMillis?.() ?? a.lastLoginAt?.toMillis?.() ?? 0)
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAllStudentActivityForAdmin(
  maxItems = 300
): Promise<StudentActivity[]> {
  const path = 'studentActivity';
  try {
    const q = query(
      collection(db, 'studentActivity'),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudentActivity, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listStudentActivityByUid(
  uid: string,
  maxItems = 150
): Promise<StudentActivity[]> {
  const path = 'studentActivity';
  try {
    const q = query(
      collection(db, 'studentActivity'),
      where('uid', '==', uid),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<StudentActivity, 'id'>) }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function setStudentBlockStatus(params: {
  target: StudentAccount;
  block: boolean;
  reason: string;
  actor: AdminUser;
}): Promise<void> {
  const { target, block, reason, actor } = params;
  const path = `studentAccounts/${target.uid}`;
  const cleanReason = reason.trim().slice(0, 500);
  try {
    const nowTs = serverTimestamp();
    await updateDoc(doc(db, 'studentAccounts', target.uid), {
      status: block ? 'blocked' : 'active',
      blockedReason: block ? cleanReason || 'Blocked by administrator' : '',
      blockedBy: block ? actor.uid : '',
      blockedByName: block ? actor.displayName.slice(0, 120) : '',
      blockedAt: block ? Timestamp.now() : null,
      updatedAt: nowTs,
    });

    await logStudentActivity({
      uid: target.uid,
      email: target.email,
      studentName: target.fullName || target.displayName,
      registrationNumber: target.registrationNumber,
      action: block ? 'admin_block' : 'admin_unblock',
      summary: block
        ? `Blocked by ${actor.displayName}${cleanReason ? `: ${cleanReason}` : ''}`
        : `Unblocked by ${actor.displayName}`,
      path: '/admin/students',
      metadata: {
        actorUid: actor.uid,
        actorName: actor.displayName,
        reason: cleanReason,
      },
    });

    await writeAuditLog({
      actor,
      action: block ? 'student.block' : 'student.unblock',
      entityType: 'studentAccount',
      entityId: target.uid,
      summary: `${block ? 'Blocked' : 'Unblocked'} student ${
        target.fullName || target.displayName || target.email
      } (${target.email})${cleanReason ? ` — Reason: ${cleanReason}` : ''}`,
      metadata: {
        studentEmail: target.email,
        registrationNumber: target.registrationNumber,
        blocked: block,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeStudentRecord(params: {
  uid: string;
  email: string;
  displayName: string;
  registrationNumber?: string;
  alsoDeleteRegistrations: boolean;
  registrations?: Registration[];
  actor: AdminUser;
}): Promise<{ removedRegistrations: number }> {
  const {
    uid,
    email,
    displayName,
    registrationNumber = '',
    alsoDeleteRegistrations,
    registrations = [],
    actor,
  } = params;

  const path = `studentAccounts/${uid}`;
  let removedRegistrations = 0;

  try {
    if (alsoDeleteRegistrations && registrations.length > 0) {
      for (const reg of registrations) {
        if (actor.role !== 'super_admin' && !actor.assignedEventIds.includes(reg.eventId)) {
          continue;
        }
        const batch = writeBatch(db);
        batch.delete(doc(db, 'registrations', reg.id));
        if (reg.lookupKey) {
          batch.delete(doc(db, 'registrationLookups', reg.lookupKey));
        }
        if (reg.studentPortalKey) {
          batch.delete(doc(db, 'studentPortals', reg.studentPortalKey, 'entries', reg.id));
        }
        const lockId = sanitizeId(
          `${reg.eventId}__${reg.gameId}__${normalizeEnrollment(reg.participant.enrollmentNumber)}`
        );
        batch.delete(doc(db, 'registrationLocks', lockId));
        await batch.commit();
        removedRegistrations += 1;
      }
    }

    // Delete studentProfile & studentAccount if they exist
    const [acctSnap, profSnap, actSnap] = await Promise.all([
      getDoc(doc(db, 'studentAccounts', uid)),
      getDoc(doc(db, 'studentProfiles', uid)),
      getDocs(query(collection(db, 'studentActivity'), where('uid', '==', uid), limit(200))),
    ]);

    if (acctSnap.exists()) {
      await deleteDoc(doc(db, 'studentAccounts', uid));
    }
    if (profSnap.exists()) {
      const profData = profSnap.data() as StudentProfile;
      await deleteDoc(doc(db, 'studentProfiles', uid));
      if (profData.regNoHash && /^[a-f0-9]{64}$/.test(profData.regNoHash)) {
        try {
          await deleteDoc(doc(db, 'enrollmentLocks', profData.regNoHash));
        } catch {
          // Non-fatal cleanup if lock was already absent
        }
      }
    }

    // Clean up user activity docs in chunks
    if (!actSnap.empty) {
      const docs = actSnap.docs;
      for (let i = 0; i < docs.length; i += 200) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + 200)) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    }

    await writeAuditLog({
      actor,
      action: 'student.remove',
      entityType: 'studentAccount',
      entityId: uid,
      summary: `Removed student ${displayName || email} (${email})${
        removedRegistrations > 0 ? ` and ${removedRegistrations} registration(s)` : ''
      }`,
      metadata: {
        studentEmail: email,
        registrationNumber,
        removedRegistrations,
      },
    });

    return { removedRegistrations };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
