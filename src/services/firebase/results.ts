import {
  collection,
  deleteDoc,
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
import { writeAuditLog } from './audit';
import { generateId } from '@/src/schemas/validation';
import type {
  AdminUser,
  GameCategory,
  ParticipationType,
  PublishedResult,
  Registration,
  ResultPlacement,
} from '@/src/types/models';

export async function listPublicResults(): Promise<PublishedResult[]> {
  const path = 'publishedResults';
  try {
    const q = query(
      collection(db, 'publishedResults'),
      where('published', '==', true),
      limit(250)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PublishedResult, 'id'>) }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listAllResultsForAdmin(): Promise<PublishedResult[]> {
  const path = 'publishedResults';
  try {
    const q = query(collection(db, 'publishedResults'), orderBy('createdAt', 'desc'), limit(300));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublishedResult, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface SavePublishedResultInput {
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  category: GameCategory;
  participationType: ParticipationType;
  winnerDisplayName: string;
  branch: string;
  year: string;
  placement: ResultPlacement;
  scoreOrRemark: string;
  registrationId: string;
  published: boolean;
}

export async function savePublishedResult(
  input: SavePublishedResultInput,
  actor: AdminUser,
  existingResult?: PublishedResult | null
): Promise<string> {
  const resultId = existingResult?.id || generateId('res');
  const path = `publishedResults/${resultId}`;
  try {
    const nowTs = serverTimestamp();
    await setDoc(doc(db, 'publishedResults', resultId), {
      eventId: input.eventId,
      eventName: input.eventName.trim().slice(0, 140),
      gameId: input.gameId,
      gameName: input.gameName.trim().slice(0, 120),
      category: input.category,
      participationType: input.participationType,
      winnerDisplayName: input.winnerDisplayName.trim().slice(0, 140),
      branch: input.branch.trim().slice(0, 80) || 'Open',
      year: input.year.trim().slice(0, 30) || 'All',
      placement: input.placement,
      scoreOrRemark: input.scoreOrRemark.trim().slice(0, 300),
      registrationId: input.registrationId || '',
      published: Boolean(input.published),
      createdBy: existingResult?.createdBy || actor.uid,
      createdAt: existingResult?.createdAt || nowTs,
      updatedAt: nowTs,
    });

    await writeAuditLog({
      actor,
      action: existingResult ? 'result.update' : 'result.create',
      entityType: 'publishedResult',
      entityId: resultId,
      summary: `${existingResult ? 'Updated' : 'Published'} ${input.placement} result for ${input.winnerDisplayName} in ${input.gameName} (${input.eventName})`,
      metadata: {
        eventId: input.eventId,
        gameId: input.gameId,
        published: input.published,
      },
    });

    return resultId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function promoteRegistrationToResult(
  reg: Registration,
  category: GameCategory,
  placement: ResultPlacement,
  scoreOrRemark: string,
  published: boolean,
  actor: AdminUser
): Promise<string> {
  const displayName =
    reg.participationType === 'team' && reg.team?.teamName
      ? reg.team.teamName
      : reg.participant.fullName;

  return savePublishedResult(
    {
      eventId: reg.eventId,
      eventName: reg.eventName,
      gameId: reg.gameId,
      gameName: reg.gameName,
      category,
      participationType: reg.participationType,
      winnerDisplayName: displayName,
      branch: reg.participant.branch,
      year: reg.participant.year,
      placement,
      scoreOrRemark,
      registrationId: reg.id,
      published,
    },
    actor
  );
}

export async function deletePublishedResult(result: PublishedResult, actor: AdminUser): Promise<void> {
  const path = `publishedResults/${result.id}`;
  try {
    await deleteDoc(doc(db, 'publishedResults', result.id));
    await writeAuditLog({
      actor,
      action: 'result.delete',
      entityType: 'publishedResult',
      entityId: result.id,
      summary: `Deleted result entry for ${result.winnerDisplayName} in ${result.gameName}`,
      metadata: { eventId: result.eventId, gameId: result.gameId },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
