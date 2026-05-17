/**
 * hooks/use-user-goals.ts
 * ------------------------------------------------------------------
 * Real-time stream of every goal that should appear in the user's
 * goals list — both personal goals they own AND team goals from
 * teams they belong to.
 *
 * Internally we run two onSnapshot subscriptions:
 *   1. watchOwnedGoals(uid)            → goals where ownerId === uid
 *   2. watchTeamGoals([their teamIds]) → goals where teamId in [...]
 *
 * The two are merged and de-duplicated by goal.id (a team goal the
 * user owns appears in both streams).  Sort: createdAt desc.
 *
 * Loading is true until *both* subscriptions have produced their
 * first snapshot (a single error from either bubbles up as `error`).
 */

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { watchOwnedGoals, watchTeamGoals } from '@/firebase/goals';
import { useUserTeams } from '@/hooks/use-user-teams';
import type { Goal } from '@/types/goal';

export interface UseUserGoalsResult {
  goals: Goal[];
  loading: boolean;
  error: Error | null;
}

export function useUserGoals(): UseUserGoalsResult {
  const { user } = useAuth();
  const { teams } = useUserTeams();

  const [ownedGoals, setOwnedGoals] = useState<Goal[]>([]);
  const [teamGoals, setTeamGoals] = useState<Goal[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [ownedError, setOwnedError] = useState<Error | null>(null);
  const [teamError, setTeamError] = useState<Error | null>(null);

  // A stable string key for `teams` so the team-goals effect only
  // re-subscribes when the *set* of team ids actually changes
  // (memberships are mostly add/remove, not reordering).
  const teamIds = useMemo(() => teams.map((t) => t.team.id), [teams]);
  const teamIdsKey = useMemo(() => [...teamIds].sort().join(','), [teamIds]);

  // ----- Owned goals -----
  useEffect(() => {
    if (!user) {
      setOwnedGoals([]);
      setOwnedLoading(false);
      return;
    }
    setOwnedLoading(true);
    setOwnedError(null);
    const unsubscribe = watchOwnedGoals(
      user.uid,
      (next) => {
        setOwnedGoals(next);
        setOwnedLoading(false);
      },
      (err) => {
        setOwnedError(err);
        setOwnedLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  // ----- Team goals -----
  useEffect(() => {
    if (teamIds.length === 0) {
      setTeamGoals([]);
      setTeamLoading(false);
      return;
    }
    setTeamLoading(true);
    setTeamError(null);
    const unsubscribe = watchTeamGoals(
      teamIds,
      (next) => {
        setTeamGoals(next);
        setTeamLoading(false);
      },
      (err) => {
        setTeamError(err);
        setTeamLoading(false);
      }
    );
    return unsubscribe;
    // teamIds is a fresh array every render; use the stable key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamIdsKey]);

  // ----- Merge -----
  const goals = useMemo(() => {
    const map = new Map<string, Goal>();
    for (const g of ownedGoals) map.set(g.id, g);
    for (const g of teamGoals) map.set(g.id, g); // overwrites duplicates harmlessly
    return Array.from(map.values()).sort((a, b) => {
      const aT = a.createdAt?.toMillis() ?? 0;
      const bT = b.createdAt?.toMillis() ?? 0;
      return bT - aT;
    });
  }, [ownedGoals, teamGoals]);

  return {
    goals,
    loading: ownedLoading || teamLoading,
    error: ownedError ?? teamError,
  };
}
