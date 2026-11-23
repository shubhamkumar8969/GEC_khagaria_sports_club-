import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { generateId } from '@/src/schemas/validation';
import type { AdminUser, AuditLog } from '@/src/types/models';

export async function writeAuditLog(params: {
  actor: AdminUser;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<void> {
  const logId = generateId('log');
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      actorUid: params.actor.uid,
      actorEmail: params.actor.email,
      actorName: params.actor.displayName,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary.slice(0, 500),
      metadata: params.metadata ?? {},
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listAuditLogs(actor: AdminUser, maxItems = 150): Promise<AuditLog[]> {
  const path = 'auditLogs';
  try {
    const colRef = collection(db, 'auditLogs');
    const q =
      actor.role === 'super_admin'
        ? query(colRef, orderBy('createdAt', 'desc'), limit(maxItems))
        : query(colRef, where('actorUid', '==', actor.uid), orderBy('createdAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
