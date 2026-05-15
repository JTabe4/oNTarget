/**
 * types/team.ts
 * ------------------------------------------------------------------
 * Shapes for `teams/{teamId}` and `teamMembers/{membershipId}`.
 *
 * Naming: the product calls these "teams" and the membership owner a
 * "team leader" — that vocabulary should stay consistent across
 * model, repository, hooks, and UI.
 */

import type { Timestamp } from 'firebase/firestore';

/** Role values on a membership doc. */
export type TeamRole = 'team_leader' | 'member';

/**
 * A team.  Same field list as your spec, plus an `id` we hydrate
 * onto the object after reading (Firestore doesn't store it inside
 * the doc — the doc's key IS the id).
 */
export interface Team {
  id: string;

  name: string;
  description: string;

  teamLeaderId: string;
  teamLeaderUsername: string;

  /** Short alphanumeric code the leader shares to invite members. */
  inviteCode: string;

  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/**
 * Membership in a team.  We use a deterministic doc id of
 * `${teamId}_${userId}` so duplicate memberships are structurally
 * impossible.  We hydrate `id` onto the object after read.
 */
export interface TeamMember {
  id: string;

  teamId: string;
  userId: string;
  username: string;

  role: TeamRole;
  joinedAt: Timestamp | null;
}

/** What the user fills in on the Create Team form. */
export interface NewTeamInput {
  name: string;
  description: string;
}

/** Helper used by the list screen to render a team + my role together. */
export interface TeamWithMembership {
  team: Team;
  membership: TeamMember;
}
