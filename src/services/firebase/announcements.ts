import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import { generateId } from '@/src/schemas/validation';
import type {
  AdminUser,
  Announcement,
  AnnouncementCategory,
  AnnouncementStatus,
} from '@/src/types/models';

export async function listPublicAnnouncements(): Promise<Announcement[]> {
  const path = 'announcements';
  try {
    const q = query(collection(db, 'announcements'), where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
      .sort((a, b) => (b.publishAt?.toMillis?.() ?? 0) - (a.publishAt?.toMillis?.() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAllAnnouncements(): Promise<Announcement[]> {
  const path = 'announcements';
  try {
    const snap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface SaveAnnouncementInput {
  id?: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  eventId: string;
  imageUrl?: string;
  status: AnnouncementStatus;
  publishAt: Date;
}

export async function saveAnnouncement(
  input: SaveAnnouncementInput,
  actor: AdminUser
): Promise<string> {
  const isNew = !input.id;
  const announcementId = input.id || generateId('ann');
  const path = `announcements/${announcementId}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'announcements', announcementId), {
        title: input.title.trim(),
        body: input.body.trim(),
        category: input.category,
        eventId: input.eventId.trim(),
        imageUrl: (input.imageUrl || '').trim(),
        status: input.status,
        publishAt: Timestamp.fromDate(input.publishAt),
        createdBy: actor.uid,
        createdByName: actor.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actor,
        action: 'announcement.create',
        entityType: 'announcement',
        entityId: announcementId,
        summary: `Created announcement "${input.title.trim()}" (${input.status})`,
      });
    } else {
      await updateDoc(doc(db, 'announcements', announcementId), {
        title: input.title.trim(),
        body: input.body.trim(),
        category: input.category,
        eventId: input.eventId.trim(),
        imageUrl: (input.imageUrl || '').trim(),
        status: input.status,
        publishAt: Timestamp.fromDate(input.publishAt),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actor,
        action: 'announcement.update',
        entityType: 'announcement',
        entityId: announcementId,
        summary: `Updated announcement "${input.title.trim()}" (${input.status})`,
      });
    }
    return announcementId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteAnnouncement(announcement: Announcement, actor: AdminUser): Promise<void> {
  const path = `announcements/${announcement.id}`;
  try {
    await deleteDoc(doc(db, 'announcements', announcement.id));
    await writeAuditLog({
      actor,
      action: 'announcement.delete',
      entityType: 'announcement',
      entityId: announcement.id,
      summary: `Deleted announcement "${announcement.title}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
