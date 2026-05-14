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

/** Map a Firestore document → Goal (adds `id` from the doc key). */
function docToGoal(snap: QueryDocumentSnapshot<DocumentData>): Goal {
  return { id: snap.id, ...(snap.data() as Omit<Goal, 'id'>) };
}

/** Convert a JS Date (or null) into a Firestore Timestamp for storage. */
function toTimestamp(d: Date | null): Timestamp | null {
  return d ? Timestamp.fromDate(d) : null;
}

// ------------------------------------------------------------------
// Create
// ------------------------------------------------------------------

/**
 * Create a new (personal) goal owned by the given user.
 *
 * The form supplies user-visible fields; we compute progressPercent,
 * stamp `status: 'active'`, fill in owner/timestamps, and write.
 */
export async function createGoal(
  input: NewGoalInput,
  ownerId: string,
  ownerUsername: string
): Promise<string> {
  const progressPercent = computeProgressPercent(input.currentValue, input.targetValue);

  const ref = await addDoc(goalsCol(), {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),

    targetValue: input.targetValue,
    currentValue: input.currentValue,
    progressPercent,
    unit: input.unit.trim(),

    deadline: toTimestamp(input.deadline),

    visibility: input.visibility,
    status: 'active',

    ownerType: 'personal',
    ownerId,
    ownerUsername,
    groupId: null,
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
 * Real-time subscription to a user's goals.
 *
 * Server-side filters keep someone else's goals from ever reaching
 * the device (and the security rules enforce the same on the wire).
 * We sort newest-first.
 *
 * Note: archived goals are still returned here — the list screen
 * filters them out client-side.  Surfacing them at this layer keeps
 * the hook flexible for future "Archive" tab views without a
 * second listener.
 */
export function watchUserGoals(
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
    (snap) => {
      const goals = snap.docs.map(docToGoal);
      onChange(goals);
    },
    (err) => {
      if (onError) onError(err);
    }
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
