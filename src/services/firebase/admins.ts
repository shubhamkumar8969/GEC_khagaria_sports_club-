import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import { computeInviteId } from '@/src/schemas/validation';
import type { AdminInvite, AdminRole, AdminUser } from '@/src/types/models';

export async function listAdmins(): Promise<AdminUser[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(query(collection(db, 'admins'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => d.data() as AdminUser);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAdminInvites(): Promise<AdminInvite[]> {
  const path = 'adminInvites';
  try {
    const snap = await getDocs(query(collection(db, 'adminInvites'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminInvite, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createOrUpdateInvite(
  params: {
    email: string;
    displayName: string;
    role: AdminRole;
    assignedEventIds: string[];
    permissions: string[];
    active: boolean;
  },
  actor: AdminUser
): Promise<string> {
  const emailLower = params.email.trim().toLowerCase();
  const inviteId = await computeInviteId(emailLower);
  const path = `adminInvites/${inviteId}`;
  try {
    await setDoc(doc(db, 'adminInvites', inviteId), {
      email: emailLower,
      displayName: params.displayName.trim(),
      role: params.role,
      active: params.active,
      assignedEventIds: params.assignedEventIds,
      permissions: params.permissions,
      invitedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actor,
      action: 'admin.invite',
      entityType: 'adminInvite',
      entityId: inviteId,
      summary: `Issued ${params.role} invite for ${emailLower}`,
      metadata: { role: params.role, eventCount: params.assignedEventIds.length },
    });
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateAdminUser(
  target: AdminUser,
  updates: {
    role: AdminRole;
    active: boolean;
    assignedEventIds: string[];
    permissions: string[];
    displayName: string;
  },
  actor: AdminUser
): Promise<void> {
  const path = `admins/${target.uid}`;
  try {
    await updateDoc(doc(db, 'admins', target.uid), {
      displayName: updates.displayName.trim(),
      role: updates.role,
      active: updates.active,
      assignedEventIds: updates.assignedEventIds,
      permissions: updates.permissions,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actor,
      action: 'admin.update',
      entityType: 'admin',
      entityId: target.uid,
      summary: `Updated admin ${target.email} (role=${updates.role}, active=${updates.active})`,
      metadata: { role: updates.role, active: updates.active },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAdminInvite(invite: AdminInvite, actor: AdminUser): Promise<void> {
  const path = `adminInvites/${invite.id}`;
  try {
    await deleteDoc(doc(db, 'adminInvites', invite.id));
    await writeAuditLog({
      actor,
      action: 'admin.revoke_invite',
      entityType: 'adminInvite',
      entityId: invite.id,
      summary: `Revoked admin invite for ${invite.email}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
