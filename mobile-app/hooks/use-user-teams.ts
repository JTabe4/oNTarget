/**
 * hooks/use-user-teams.ts
 * ------------------------------------------------------------------
 * Real-time list of teams the signed-in user belongs to, paired
 * with their membership doc (so the UI can render role badges
 * without an extra read).
 */

import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { watchUserTeams } from '@/firebase/teams';
import type { TeamWithMembership } from '@/types/team';

export interface UseUserTeamsResult {
  teams: TeamWithMembership[];
  loading: boolean;
  error: Error | null;
}

export function useUserTeams(): UseUserTeamsResult {
  const { user } = useAuth();

  const [teams, setTeams] = useState<TeamWithMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = watchUserTeams(
      user.uid,
      (next) => {
        setTeams(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { teams, loading, error };
}
