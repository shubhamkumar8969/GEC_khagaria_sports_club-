import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import { generateId, slugify } from '@/src/schemas/validation';
import type {
  AdminUser,
  EventGame,
  EventStatus,
  GameCounter,
  SportEvent,
} from '@/src/types/models';

const PUBLIC_EVENT_STATUSES: EventStatus[] = [
  'published',
  'registration_open',
  'registration_closed',
  'ongoing',
  'completed',
];

export async function listPublicEvents(): Promise<SportEvent[]> {
  const path = 'events';
  try {
    const q = query(
      collection(db, 'events'),
      where('status', 'in', PUBLIC_EVENT_STATUSES)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SportEvent, 'id'>) }))
      .sort((a, b) => (b.startAt?.toMillis?.() ?? 0) - (a.startAt?.toMillis?.() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAllEventsForAdmin(actor: AdminUser): Promise<SportEvent[]> {
  const path = 'events';
  try {
    const snap = await getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc')));
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SportEvent, 'id'>) }));
    if (actor.role === 'super_admin') return all;
    return all.filter((e) => actor.assignedEventIds.includes(e.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getEventById(eventId: string): Promise<SportEvent | null> {
  const path = `events/${eventId}`;
  try {
    const snap = await getDoc(doc(db, 'events', eventId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<SportEvent, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface SaveEventInput {
  id?: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  highlightsText?: string;
  bannerUrl: string;
  venue: string;
  startAt: Date;
  endAt: Date;
  registrationStartAt: Date;
  registrationEndAt: Date;
  status: EventStatus;
  featured: boolean;
  autoApprove: boolean;
  showPublicResults: boolean;
}

export async function saveEvent(input: SaveEventInput, actor: AdminUser): Promise<string> {
  const isNew = !input.id;
  const eventId = input.id || generateId('evt');
  const path = `events/${eventId}`;

  try {
    if (isNew) {
      await setDoc(doc(db, 'events', eventId), {
        name: input.name.trim(),
        slug: slugify(input.slug || input.name),
        shortDescription: input.shortDescription.trim(),
        description: input.description.trim(),
        highlightsText: (input.highlightsText || '').trim().slice(0, 4000),
        bannerUrl: input.bannerUrl.trim(),
        venue: input.venue.trim(),
        startAt: Timestamp.fromDate(input.startAt),
        endAt: Timestamp.fromDate(input.endAt),
        registrationStartAt: Timestamp.fromDate(input.registrationStartAt),
        registrationEndAt: Timestamp.fromDate(input.registrationEndAt),
        status: input.status,
        featured: input.featured,
        autoApprove: input.autoApprove,
        showPublicResults: input.showPublicResults,
        createdBy: actor.uid,
        updatedBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actor,
        action: 'event.create',
        entityType: 'event',
        entityId: eventId,
        summary: `Created event "${input.name.trim()}" (${input.status})`,
      });
    } else {
      await updateDoc(doc(db, 'events', eventId), {
        name: input.name.trim(),
        slug: slugify(input.slug || input.name),
        shortDescription: input.shortDescription.trim(),
        description: input.description.trim(),
        highlightsText: (input.highlightsText || '').trim().slice(0, 4000),
        bannerUrl: input.bannerUrl.trim(),
        venue: input.venue.trim(),
        startAt: Timestamp.fromDate(input.startAt),
        endAt: Timestamp.fromDate(input.endAt),
        registrationStartAt: Timestamp.fromDate(input.registrationStartAt),
        registrationEndAt: Timestamp.fromDate(input.registrationEndAt),
        status: input.status,
        featured: input.featured,
        autoApprove: input.autoApprove,
        showPublicResults: input.showPublicResults,
        updatedBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actor,
        action: 'event.update',
        entityType: 'event',
        entityId: eventId,
        summary: `Updated event "${input.name.trim()}" (status: ${input.status})`,
      });
    }
    return eventId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function updateEventStatus(
  eventId: string,
  eventName: string,
  status: EventStatus,
  actor: AdminUser
): Promise<void> {
  const path = `events/${eventId}`;
  try {
    await updateDoc(doc(db, 'events', eventId), {
      status,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actor,
      action: 'event.status_change',
      entityType: 'event',
      entityId: eventId,
      summary: `Changed event "${eventName}" status to ${status}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function duplicateEvent(sourceEvent: SportEvent, actor: AdminUser): Promise<string> {
  const newEventId = generateId('evt');
  const path = `events/${newEventId}`;
  try {
    const games = await listAllGames(sourceEvent.id);
    const batch = writeBatch(db);
    const now = serverTimestamp();
    const newName = `${sourceEvent.name} (Copy)`;
    batch.set(doc(db, 'events', newEventId), {
      name: newName.slice(0, 140),
      slug: slugify(`${sourceEvent.slug}-copy-${newEventId.slice(-4)}`),
      shortDescription: sourceEvent.shortDescription,
      description: sourceEvent.description,
      highlightsText: sourceEvent.highlightsText || '',
      bannerUrl: sourceEvent.bannerUrl,
      venue: sourceEvent.venue,
      startAt: sourceEvent.startAt,
      endAt: sourceEvent.endAt,
      registrationStartAt: sourceEvent.registrationStartAt,
      registrationEndAt: sourceEvent.registrationEndAt,
      status: 'draft',
      featured: false,
      autoApprove: sourceEvent.autoApprove,
      showPublicResults: false,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    });

    for (const g of games) {
      const newGameId = generateId('gam');
      batch.set(doc(db, 'events', newEventId, 'games', newGameId), {
        eventId: newEventId,
        name: g.name,
        category: g.category,
        participationType: g.participationType,
        description: g.description,
        rules: g.rules,
        maxParticipants: g.maxParticipants,
        maxTeams: g.maxTeams,
        minTeamSize: g.minTeamSize,
        maxTeamSize: g.maxTeamSize,
        registrationDeadline: g.registrationDeadline,
        registrationStatus: 'draft',
        eligibility: g.eligibility,
        sortOrder: g.sortOrder,
        customFields: g.customFields,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    await writeAuditLog({
      actor,
      action: 'event.duplicate',
      entityType: 'event',
      entityId: newEventId,
      summary: `Duplicated event "${sourceEvent.name}" with ${games.length} games as draft`,
      metadata: { sourceEventId: sourceEvent.id, gameCount: games.length },
    });
    return newEventId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteEvent(event: SportEvent, actor: AdminUser): Promise<void> {
  const path = `events/${event.id}`;
  try {
    const games = await listAllGames(event.id);
    const chunkSize = 400;
    for (let i = 0; i < games.length; i += chunkSize) {
      const batch = writeBatch(db);
      for (const g of games.slice(i, i + chunkSize)) {
        batch.delete(doc(db, 'events', event.id, 'games', g.id));
      }
      await batch.commit();
    }
    await deleteDoc(doc(db, 'events', event.id));
    await writeAuditLog({
      actor,
      action: 'event.delete',
      entityType: 'event',
      entityId: event.id,
      summary: `Deleted event "${event.name}" and ${games.length} game(s)`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const deleteDraftEvent = deleteEvent;

export async function listPublicGames(eventId: string): Promise<EventGame[]> {
  const path = `events/${eventId}/games`;
  try {
    const q = query(
      collection(db, 'events', eventId, 'games'),
      where('registrationStatus', 'in', ['open', 'closed'])
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EventGame, 'id'>) }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAllGames(eventId: string): Promise<EventGame[]> {
  const path = `events/${eventId}/games`;
  try {
    const snap = await getDocs(collection(db, 'events', eventId, 'games'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EventGame, 'id'>) }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getGameById(eventId: string, gameId: string): Promise<EventGame | null> {
  const path = `events/${eventId}/games/${gameId}`;
  try {
    const snap = await getDoc(doc(db, 'events', eventId, 'games', gameId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<EventGame, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface SaveGameInput {
  id?: string;
  eventId: string;
  name: string;
  category: EventGame['category'];
  participationType: EventGame['participationType'];
  description: string;
  rules: string;
  maxParticipants: number;
  maxTeams: number;
  minTeamSize: number;
  maxTeamSize: number;
  registrationDeadline: Date;
  registrationStatus: EventGame['registrationStatus'];
  eligibility: string;
  sortOrder: number;
  customFields: EventGame['customFields'];
}

export async function saveGame(input: SaveGameInput, actor: AdminUser): Promise<string> {
  const isNew = !input.id;
  const gameId = input.id || generateId('gam');
  const path = `events/${input.eventId}/games/${gameId}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'events', input.eventId, 'games', gameId), {
        eventId: input.eventId,
        name: input.name.trim(),
        category: input.category,
        participationType: input.participationType,
        description: input.description.trim(),
        rules: input.rules.trim(),
        maxParticipants: input.maxParticipants,
        maxTeams: input.maxTeams,
        minTeamSize: input.minTeamSize,
        maxTeamSize: input.maxTeamSize,
        registrationDeadline: Timestamp.fromDate(input.registrationDeadline),
        registrationStatus: input.registrationStatus,
        eligibility: input.eligibility.trim(),
        sortOrder: input.sortOrder,
        customFields: input.customFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actor,
        action: 'game.create',
        entityType: 'game',
        entityId: gameId,
        summary: `Added game "${input.name.trim()}" (${input.participationType}) to event ${input.eventId}`,
        metadata: { eventId: input.eventId },
      });
    } else {
      await updateDoc(doc(db, 'events', input.eventId, 'games', gameId), {
        name: input.name.trim(),
        category: input.category,
        participationType: input.participationType,
        description: input.description.trim(),
        rules: input.rules.trim(),
        maxParticipants: input.maxParticipants,
        maxTeams: input.maxTeams,
        minTeamSize: input.minTeamSize,
        maxTeamSize: input.maxTeamSize,
        registrationDeadline: Timestamp.fromDate(input.registrationDeadline),
        registrationStatus: input.registrationStatus,
        eligibility: input.eligibility.trim(),
        sortOrder: input.sortOrder,
        customFields: input.customFields,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actor,
        action: 'game.update',
        entityType: 'game',
        entityId: gameId,
        summary: `Updated game "${input.name.trim()}" configuration & form fields`,
        metadata: { eventId: input.eventId, customFieldCount: input.customFields.length },
      });
    }
    return gameId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveMultipleGamesBatch(
  eventId: string,
  games: Array<Omit<SaveGameInput, 'id' | 'eventId'>>,
  actor: AdminUser
): Promise<number> {
  if (games.length === 0) return 0;
  const path = `events/${eventId}/games`;
  try {
    const batch = writeBatch(db);
    const ts = serverTimestamp();
    const createdNames: string[] = [];

    for (const item of games) {
      const gameId = generateId('gam');
      createdNames.push(item.name.trim());
      batch.set(doc(db, 'events', eventId, 'games', gameId), {
        eventId,
        name: item.name.trim(),
        category: item.category,
        participationType: item.participationType,
        description: item.description.trim(),
        rules: item.rules.trim(),
        maxParticipants: item.maxParticipants,
        maxTeams: item.maxTeams,
        minTeamSize: item.minTeamSize,
        maxTeamSize: item.maxTeamSize,
        registrationDeadline: Timestamp.fromDate(item.registrationDeadline),
        registrationStatus: item.registrationStatus,
        eligibility: item.eligibility.trim(),
        sortOrder: item.sortOrder,
        customFields: item.customFields,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    await batch.commit();
    await writeAuditLog({
      actor,
      action: 'game.batch_create',
      entityType: 'game',
      entityId: eventId,
      summary: `Added ${games.length} games (${createdNames.slice(0, 6).join(', ')}${games.length > 6 ? '...' : ''}) to event ${eventId}`,
      metadata: { eventId, count: games.length },
    });
    return games.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGame(eventId: string, game: EventGame, actor: AdminUser): Promise<void> {
  const path = `events/${eventId}/games/${game.id}`;
  try {
    await deleteDoc(doc(db, 'events', eventId, 'games', game.id));
    await writeAuditLog({
      actor,
      action: 'game.delete',
      entityType: 'game',
      entityId: game.id,
      summary: `Deleted game "${game.name}"`,
      metadata: { eventId },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const deleteDraftGame = deleteGame;

export async function getGameCounterCount(eventId: string, gameId: string): Promise<number> {
  const counterId = `${eventId}__${gameId}`;
  const path = `gameCounters/${counterId}`;
  try {
    const snap = await getDoc(doc(db, 'gameCounters', counterId));
    if (!snap.exists()) return 0;
    const data = snap.data() as GameCounter;
    return data.count ?? 0;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
