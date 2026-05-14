/**
 * types/goal.ts
 * ------------------------------------------------------------------
 * Shared TypeScript types for the Goal domain.
 *
 * Why a separate file?
 *   Goals are referenced from screens, components, hooks, and the
 *   Firestore repository.  Putting the shapes in one place avoids
 *   circular imports and makes the model the source of truth.
 */

import type { Timestamp } from 'firebase/firestore';

/** Who can see this goal. */
export type GoalVisibility = 'private' | 'group' | 'coach_only' | 'public';

/** Lifecycle state.  `archived` is our soft-delete. */
export type GoalStatus = 'active' | 'completed' | 'archived';

/** Why this goal exists.  All MVP goals are 'personal'. */
export type GoalOwnerType = 'personal' | 'group' | 'coach_assigned';

/**
 * Goal as it exists in Firestore (`goals/{goalId}`).
 *
 * `id` is *not* stored inside the document — it's the document's
 * own key.  We hydrate it onto the object after reading so that
 * components can reference `goal.id` without bookkeeping.
 *
 * Timestamps are nullable because:
 *   - `createdAt` / `updatedAt` use `serverTimestamp()` and read back
 *     null for one frame after the write returns from the client
 *     SDK before the server commit settles
 *   - `deadline` is optional (users can create goals without one)
 */
export interface Goal {
  id: string;

  title: string;
  description: string;
  category: string;

  targetValue: number;
  currentValue: number;
  progressPercent: number;
  unit: string;

  deadline: Timestamp | null;

  visibility: GoalVisibility;
  status: GoalStatus;

  ownerType: GoalOwnerType;
  ownerId: string;
  ownerUsername: string;
  groupId: string | null;
  assignedBy: string | null;

  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/**
 * What the user fills in when creating a goal — derived fields
 * (progressPercent, status, owner*, timestamps) are filled in by the
 * repository layer, not by the form.
 */
export interface NewGoalInput {
  title: string;
  description: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: Date | null;
  visibility: GoalVisibility;
}

/**
 * What's editable on an existing goal.  Owner fields, timestamps,
 * and the `status` workflow live elsewhere.
 */
export interface GoalEditableFields {
  title: string;
  description: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: Date | null;
  visibility: GoalVisibility;
}

/**
 * Calculate `progressPercent` from current / target.
 *
 *   - Always returns a finite number 0-100
 *   - Rounded to 1 decimal place
 *   - Returns 0 if target is zero or invalid (avoid divide-by-zero)
 *
 * Defined once so screens, the repository, and the details
 * "quick update" widget agree on the math.
 */
export function computeProgressPercent(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
    return 0;
  }
  const raw = (current / target) * 100;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped * 10) / 10;
}
