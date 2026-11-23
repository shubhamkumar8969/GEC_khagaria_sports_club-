import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import { generateId } from '@/src/schemas/validation';
import type { AdminUser, EventPhoto } from '@/src/types/models';

export async function listPublicEventPhotos(eventIdFilter?: string): Promise<EventPhoto[]> {
  const path = 'eventPhotos';
  try {
    const q = query(collection(db, 'eventPhotos'), where('published', '==', true));
    const snap = await getDocs(q);
    let list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EventPhoto, 'id'>) }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    if (eventIdFilter && eventIdFilter !== 'all') {
      list = list.filter((p) => p.eventId === eventIdFilter);
    }
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAllPhotosForAdmin(actor: AdminUser): Promise<EventPhoto[]> {
  const path = 'eventPhotos';
  try {
    const snap = await getDocs(collection(db, 'eventPhotos'));
    const all = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EventPhoto, 'id'>) }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    if (actor.role === 'super_admin') return all;
    return all.filter((p) => actor.assignedEventIds.includes(p.eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface SaveEventPhotoInput {
  eventId: string;
  eventName: string;
  title: string;
  caption: string;
  imageUrl: string;
  published: boolean;
}

export async function saveEventPhoto(
  input: SaveEventPhotoInput,
  actor: AdminUser
): Promise<string> {
  const photoId = generateId('pho');
  const path = `eventPhotos/${photoId}`;
  try {
    await setDoc(doc(db, 'eventPhotos', photoId), {
      eventId: input.eventId,
      eventName: input.eventName.trim().slice(0, 140),
      title: input.title.trim().slice(0, 160),
      caption: input.caption.trim().slice(0, 500),
      imageUrl: input.imageUrl.trim().slice(0, 450000),
      published: input.published,
      uploadedBy: actor.uid,
      uploadedByName: actor.displayName.slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actor,
      action: 'photo.upload',
      entityType: 'eventPhoto',
      entityId: photoId,
      summary: `Uploaded event photo "${input.title.trim()}" for ${input.eventName}`,
      metadata: { eventId: input.eventId, published: input.published },
    });
    return photoId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleEventPhotoPublished(
  photo: EventPhoto,
  published: boolean,
  actor: AdminUser
): Promise<void> {
  const path = `eventPhotos/${photo.id}`;
  try {
    await updateDoc(doc(db, 'eventPhotos', photo.id), {
      published,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actor,
      action: published ? 'photo.publish' : 'photo.unpublish',
      entityType: 'eventPhoto',
      entityId: photo.id,
      summary: `${published ? 'Published' : 'Unpublished'} photo "${photo.title}"`,
      metadata: { eventId: photo.eventId },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEventPhoto(photo: EventPhoto, actor: AdminUser): Promise<void> {
  const path = `eventPhotos/${photo.id}`;
  try {
    await deleteDoc(doc(db, 'eventPhotos', photo.id));
    await writeAuditLog({
      actor,
      action: 'photo.delete',
      entityType: 'eventPhoto',
      entityId: photo.id,
      summary: `Deleted event photo "${photo.title}" (${photo.eventName})`,
      metadata: { eventId: photo.eventId },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
