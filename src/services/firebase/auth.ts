import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './config';
import { computeInviteId } from '@/src/schemas/validation';
import type { AdminInvite, AdminUser } from '@/src/types/models';

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export async function resolveAdminProfile(user: User): Promise<AdminUser | null> {
  if (!user.email || !user.emailVerified) {
    return null;
  }

  const adminPath = `admins/${user.uid}`;
  try {
    const existingSnap = await getDoc(doc(db, 'admins', user.uid));
    if (existingSnap.exists()) {
      const data = existingSnap.data() as AdminUser;
      if (!data.active) {
        return null;
      }
      return data;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, adminPath);
  }

  const emailLower = user.email.trim().toLowerCase();

  // Bootstrap primary super admin on first login
  if (emailLower === BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    const newAdmin = {
      uid: user.uid,
      displayName: user.displayName || 'Sports Club Super Admin',
      email: emailLower,
      role: 'super_admin' as const,
      active: true,
      assignedEventIds: [] as string[],
      permissions: ['all'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'admins', user.uid), newAdmin);
      const created = await getDoc(doc(db, 'admins', user.uid));
      return created.exists() ? (created.data() as AdminUser) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, adminPath);
    }
  }

  // Check if user has a pre-authorized invite matching their verified email
  const inviteId = await computeInviteId(emailLower);
  const invitePath = `adminInvites/${inviteId}`;
  try {
    const inviteSnap = await getDoc(doc(db, 'adminInvites', inviteId));
    if (!inviteSnap.exists()) {
      return null;
    }
    const invite = inviteSnap.data() as Omit<AdminInvite, 'id'>;
    if (!invite.active || invite.email.toLowerCase() !== emailLower) {
      return null;
    }

    const acceptedAdmin = {
      uid: user.uid,
      displayName: user.displayName || invite.displayName,
      email: emailLower,
      role: invite.role,
      active: true,
      assignedEventIds: invite.assignedEventIds,
      permissions: invite.permissions,
      inviteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'admins', user.uid), acceptedAdmin);
    const created = await getDoc(doc(db, 'admins', user.uid));
    return created.exists() ? (created.data() as AdminUser) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, invitePath);
  }
}
