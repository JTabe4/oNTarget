/**
 * hooks/use-user-goals.ts
 * ------------------------------------------------------------------
 * Real-time subscription to the signed-in user's goals.
 *
 * Why a hook?
 *   - Encapsulates the onSnapshot lifecycle (mount → subscribe,
 *     unmount → unsubscribe) so screens don't repeat that boilerplate.
 *   - Returns a stable shape `{ goals, loading, error }` that any
 *     screen can render against.
 *
 * What's NOT here:
 *   - Filtering out archived goals — that's a per-screen concern
 *     (the list hides them; an "Archive" view later would show them).
 */

import { useEffect, useState } from 'react';

import { watchUserGoals } from '@/firebase/goals';
import type { Goal } from '@/types/goal';
import { useAuth } from '@/context/AuthContext';

export interface UseUserGoalsResult {
  goals: Goal[];
  loading: boolean;
  error: Error | null;
}

export function useUserGoals(): UseUserGoalsResult {
  const { user } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = watchUserGoals(
      user.uid,
      (nextGoals) => {
        setGoals(nextGoals);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { goals, loading, error };
}
