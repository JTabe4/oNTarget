/**
 * firebase/goals.ts
 * ------------------------------------------------------------------
 * The ONE place that talks to the `goals/{goalId}` Firestore
 * collection.  Screens and hooks call into here — they never call
 * `addDoc` / `setDoc` / `onSnapshot` themselves.
 *
 * Why a dedicated module?
 *   - Easier to evolve the schema in one place (e.g. add a field
 *     defaulted at write time)
 *   - Easier to swap to a different backend or to mock for tests
 *   - Keeps screens focused on UI
 */

import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/firebase/config';
import {
  type Goal,
  type GoalEditableFields,
  type NewGoalInput,
  computeProgressPercent,
} from '@/types/goal';

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

const goalsCol = () => collection(db, 'goals');
const goalDoc = (id: string) => doc(db, 'goals', id);

/**
 * Map a Firestore document → Goal.  Two compatibility shims:
 *   - Legacy docs used `groupId` instead of `teamId`; we read either.
 *   - Legacy docs may have visibility 'group'; we map it to 'team'.
 * Both mean we don't need a migration script to keep old data alive.
 */
function docToGoal(snap: QueryDocumentSnapshot<DocumentData>): Goal {
  const data = snap.data() as Record<string, any>;
  const teamId = data.teamId ?? data.groupId ?? null;
  const visibility = data.visibility === 'group' ? 'team' : data.visibility;
  return {
    ...(data as Omit<Goal, 'id'>),
    id: snap.id,
    teamId,
    visibility,
  };
}

/** Convert a JS Date (or null) into a Firestore Timestamp for storage. */
function toTimestamp(d: Date | null): Timestamp | null {
  return d ? Timestamp.fromDate(d) : null;
}

// ------------------------------------------------------------------
// Create
// ------------------------------------------------------------------

/**
 * Create a goal owned by the given user.  May be personal (no team)
 * or attached to one of the user's teams.
 *
 * Sanity rules applied here so screens can't write bad combinations:
 *   - ownerType === 'team' MUST come with a non-null teamId.
 *   - For team goals we force visibility = 'team' regardless of what
 *     the form sent.
 *   - For personal goals we force teamId = null (defensive).
 */
export async function createGoal(
  input: NewGoalInput,
  ownerId: string,
  ownerUsername: string
): Promise<string> {
  const progressPercent = computeProgressPercent(input.currentValue, input.targetValue);

  const isTeamGoal = input.ownerType === 'team';
  if (isTeamGoal && !input.teamId) {
    throw new Error('Team goals require a team.');
  }

  const ref = await addDoc(goalsCol(), {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),

    targetValue: input.targetValue,
    currentValue: input.currentValue,
    progressPercent,
    unit: input.unit.trim(),

    deadline: toTimestamp(input.deadline),

    visibility: isTeamGoal ? 'team' : input.visibility,
    status: 'active',

    ownerType: input.ownerType,
    ownerId,
    ownerUsername,
    teamId: isTeamGoal ? input.teamId : null,
    assignedBy: null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

// ------------------------------------------------------------------
// Read
// ------------------------------------------------------------------

/** Fetch one goal by id.  Returns null if it doesn't exist. */
export async function getGoal(goalId: string): Promise<Goal | null> {
  const snap = await getDoc(goalDoc(goalId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Goal, 'id'>) };
}

/**
 * Real-time subscription to goals OWNED by a user — i.e., the
 * personal goals plus any team goals that user created.
 *
 * Sort: newest first.  Archived goals are still returned here so
 * the list screen can choose how to filter them.
 */
export function watchOwnedGoals(
  ownerId: string,
  onChange: (goals: Goal[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    goalsCol(),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(docToGoal)),
    (err) => onError?.(err)
  );
}

/**
 * Real-time subscription to all goals belonging to ANY of the given
 * team ids.  Used so members see their teams' goals in the goals
 * list — not just their personal ones.
 *
 * Firestore's `where('teamId', 'in', […])` accepts up to 30 values.
 * We cap at 30 here; if a user belongs to more we'll lose visibility
 * into the tail teams (acceptable at MVP scale).
 */
export function watchTeamGoals(
  teamIds: string[],
  onChange: (goals: Goal[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (teamIds.length === 0) {
    onChange([]);
    return () => {};
  }
  const capped = teamIds.slice(0, 30);
  const q = query(
    goalsCol(),
    where('teamId', 'in', capped),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(docToGoal)),
    (err) => onError?.(err)
  );
}

// ------------------------------------------------------------------
// Update
// ------------------------------------------------------------------

/**
 * Edit all the user-facing fields on a goal.  We recompute
 * progressPercent here so callers can't forget.
 */
export async function updateGoal(
  goalId: string,
  fields: GoalEditableFields
): Promise<void> {
  const progressPercent = computeProgressPercent(fields.currentValue, fields.targetValue);

  await updateDoc(goalDoc(goalId), {
    title: fields.title.trim(),
    description: fields.description.trim(),
    category: fields.category.trim(),
    targetValue: fields.targetValue,
    currentValue: fields.currentValue,
    progressPercent,
    unit: fields.unit.trim(),
    deadline: toTimestamp(fields.deadline),
    visibility: fields.visibility,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Fast path for the details-screen "quick update" widget — only
 * changes currentValue and the derived progressPercent.  We need
 * targetValue to recompute, so the caller passes it in (it already
 * has it cached on the screen).
 */
export async function updateGoalProgress(
  goalId: string,
  currentValue: number,
  targetValue: number
): Promise<void> {
  await updateDoc(goalDoc(goalId), {
    currentValue,
    progressPercent: computeProgressPercent(currentValue, targetValue),
    updatedAt: serverTimestamp(),
  });
}

/** Mark a goal as completed (or revert it to active). */
export async function setGoalStatus(
  goalId: string,
  status: 'active' | 'completed'
): Promise<void> {
  await updateDoc(goalDoc(goalId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

// ------------------------------------------------------------------
// Archive / Delete
// ------------------------------------------------------------------

/**
 * Archive a goal (soft delete).  Keeps the document so the user can
 * un-archive later, and so historical progress is preserved.  The
 * list screen hides archived goals by default.
 */
export async function archiveGoal(goalId: string): Promise<void> {
  await updateDoc(goalDoc(goalId), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Permanent delete.  Provided for completeness (e.g. account
 * scrubbing) but not wired into the MVP UI.
 */
export async function deleteGoal(goalId: string): Promise<void> {
  await deleteDoc(goalDoc(goalId));
}
