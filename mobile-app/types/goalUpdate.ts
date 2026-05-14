/**
 * types/goalUpdate.ts
 * ------------------------------------------------------------------
 * Shapes for the `goalUpdates/{updateId}` collection.
 *
 * An "update" is a user's note about progress toward a goal — text,
 * optionally one image.  Updates do NOT touch goal.currentValue or
 * goal.progressPercent; that's an explicit user action on the
 * details screen.  Decoupling them lets us add reactions/comments
 * later without re-shaping the goal document.
 */

import type { Timestamp } from 'firebase/firestore';

export interface GoalUpdate {
  /** Firestore document id (not stored in the doc; hydrated on read). */
  id: string;

  /** Which goal this update belongs to. */
  goalId: string;

  /** Author. */
  userId: string;
  username: string;

  /** Required body text. */
  text: string;

  /** Public download URL from Firebase Storage, or null if no image. */
  imageUrl: string | null;

  /** serverTimestamp(); null for one frame after write before commit settles. */
  createdAt: Timestamp | null;
}

/** Form-side input from the composer. */
export interface NewGoalUpdateInput {
  goalId: string;
  text: string;
  /** Optional local image URI from expo-image-picker. */
  imageUri: string | null;
}
