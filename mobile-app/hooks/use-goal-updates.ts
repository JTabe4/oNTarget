/**
 * hooks/use-goal-updates.ts
 * ------------------------------------------------------------------
 * Real-time subscription to one goal's updates.
 *
 * Mirrors the shape of useUserGoals — `{ items, loading, error }` —
 * so screens consume both lists with the same idioms.
 */

import { useEffect, useState } from 'react';

import { watchGoalUpdates } from '@/firebase/goalUpdates';
import type { GoalUpdate } from '@/types/goalUpdate';

export interface UseGoalUpdatesResult {
  updates: GoalUpdate[];
  loading: boolean;
  error: Error | null;
}

export function useGoalUpdates(goalId: string | undefined): UseGoalUpdatesResult {
  const [updates, setUpdates] = useState<GoalUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!goalId) {
      setUpdates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = watchGoalUpdates(
      goalId,
      (next) => {
        setUpdates(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [goalId]);

  return { updates, loading, error };
}
