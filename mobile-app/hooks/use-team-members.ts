/**
 * hooks/use-team-members.ts
 * ------------------------------------------------------------------
 * Real-time list of all members for one team.  Used by the team
 * details screen.
 */

import { useEffect, useState } from 'react';

import { watchTeamMembers } from '@/firebase/teams';
import type { TeamMember } from '@/types/team';

export interface UseTeamMembersResult {
  members: TeamMember[];
  loading: boolean;
  error: Error | null;
}

export function useTeamMembers(teamId: string | undefined): UseTeamMembersResult {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = watchTeamMembers(
      teamId,
      (next) => {
        setMembers(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [teamId]);

  return { members, loading, error };
}
