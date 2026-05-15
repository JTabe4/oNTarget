/**
 * firebase/teams.ts
 * ------------------------------------------------------------------
 * Repository for the Team System.
 *
 * Collections owned by this module:
 *   teams/{teamId}                         — the team itself
 *   inviteCodes/{INVITE_CODE}              — public lookup so a
 *                                            non-member can map a
 *                                            code → teamId before
 *                                            they're allowed to read
 *                                            the team itself
 *   teamMembers/{teamId_userId}            — deterministic id keeps
 *                                            duplicate memberships
 *                                            structurally impossible
 */

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/firebase/config';
import type {
  NewTeamInput,
  Team,
  TeamMember,
  TeamWithMembership,
} from '@/types/team';

// ------------------------------------------------------------------
// Collection helpers
// ------------------------------------------------------------------

const teamsCol = () => collection(db, 'teams');
const inviteCodesCol = () => collection(db, 'inviteCodes');
const teamMembersCol = () => collection(db, 'teamMembers');

const teamDoc = (id: string) => doc(db, 'teams', id);
const inviteCodeDoc = (code: string) => doc(db, 'inviteCodes', code);
const membershipDoc = (teamId: string, userId: string) =>
  doc(db, 'teamMembers', `${teamId}_${userId}`);

function docToTeam(snap: QueryDocumentSnapshot<DocumentData>): Team {
  return { id: snap.id, ...(snap.data() as Omit<Team, 'id'>) };
}

function docToMember(snap: QueryDocumentSnapshot<DocumentData>): TeamMember {
  return { id: snap.id, ...(snap.data() as Omit<TeamMember, 'id'>) };
}

// ------------------------------------------------------------------
// Invite codes
// ------------------------------------------------------------------

/**
 * Generate a 6-character invite code from an unambiguous alphabet
 * (no 0/O or 1/I, etc.).  ~1 billion combinations means collisions
 * are vanishingly rare at MVP scale.
 */
function randomInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Generate a code that isn't already in use.  Retries up to 5 times
 * before giving up (so we never spin forever if the random source
 * is somehow broken).
 */
async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInviteCode();
    const snap = await getDoc(inviteCodeDoc(code));
    if (!snap.exists()) return code;
  }
  throw new Error('Could not allocate an invite code. Please try again.');
}

// ------------------------------------------------------------------
// Create
// ------------------------------------------------------------------

/**
 * Create a team owned by the given user.
 *
 * Write order:
 *   1. team doc                — establishes ownership
 *   2. inviteCodes/{code} doc  — enables future invite-code lookups
 *   3. leader membership doc   — so the leader appears in the
 *                                members list AND read-rules for
 *                                /teams pass for them
 *
 * Why sequential and not transactional?
 *   Firestore rules evaluate batch/transaction writes against the
 *   *pre-batch* state.  The leader-membership rule (`get(team)…`)
 *   would fail in the same batch that creates the team.  Sequential
 *   writes sidestep this; the (very small) failure window between
 *   writes is acceptable for MVP.
 */
export async function createTeam(
  input: NewTeamInput,
  leaderId: string,
  leaderUsername: string
): Promise<string> {
  const inviteCode = await generateUniqueInviteCode();

  // Allocate a new team ref so we can reuse the id below.
  const teamRef = doc(teamsCol());
  const teamId = teamRef.id;

  // 1. team
  await setDoc(teamRef, {
    name: input.name.trim(),
    description: input.description.trim(),
    teamLeaderId: leaderId,
    teamLeaderUsername: leaderUsername,
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. invite-code lookup
  await setDoc(inviteCodeDoc(inviteCode), { teamId });

  // 3. leader membership (deterministic id → no duplicates)
  await setDoc(membershipDoc(teamId, leaderId), {
    teamId,
    userId: leaderId,
    username: leaderUsername,
    role: 'team_leader',
    joinedAt: serverTimestamp(),
  });

  return teamId;
}

// ------------------------------------------------------------------
// Join
// ------------------------------------------------------------------

/**
 * Join a team using an invite code.
 *
 * The membership doc's `inviteCode` field is included only so the
 * Firestore rule can verify the requesting user actually knew the
 * code (via `get(inviteCodes/{code}).data.teamId == teamId`).  We
 * keep the field on the doc afterwards — it's harmless and keeps the
 * rule simple.
 */
export async function joinTeamByInviteCode(
  inviteCode: string,
  userId: string,
  username: string
): Promise<string> {
  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) throw new Error('Enter an invite code.');

  // Resolve code → teamId.
  const lookupSnap = await getDoc(inviteCodeDoc(normalized));
  if (!lookupSnap.exists()) {
    throw new Error('Invite code not found.');
  }
  const { teamId } = lookupSnap.data() as { teamId: string };

  // Friendly error before hitting the rules: are we already a member?
  const existing = await getDoc(membershipDoc(teamId, userId));
  if (existing.exists()) {
    throw new Error('You are already a member of this team.');
  }

  // Create the membership.  Deterministic id makes duplicate writes
  // a no-op even if the friendly check above races.
  await setDoc(membershipDoc(teamId, userId), {
    teamId,
    userId,
    username,
    role: 'member',
    joinedAt: serverTimestamp(),
    // For the security rule only:
    inviteCode: normalized,
  });

  return teamId;
}

// ------------------------------------------------------------------
// Read
// ------------------------------------------------------------------

export async function getTeam(teamId: string): Promise<Team | null> {
  const snap = await getDoc(teamDoc(teamId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Team, 'id'>) };
}

/**
 * Live subscription to teams the user belongs to.
 *
 * Implementation:
 *   - We subscribe to the user's memberships (real-time).
 *   - On each membership snapshot we fetch the matching team docs
 *     once via getDoc.  Team info changes (rename/description edit)
 *     surface the next time the user opens the details screen, which
 *     has its own live listener.
 */
export function watchUserTeams(
  userId: string,
  onChange: (teams: TeamWithMembership[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    teamMembersCol(),
    where('userId', '==', userId),
    orderBy('joinedAt', 'desc')
  );

  return onSnapshot(
    q,
    async (snap) => {
      const memberships = snap.docs.map(docToMember);

      // Fetch the team for each membership.  If a team disappeared
      // (e.g. deleted later), skip it gracefully.
      const results: TeamWithMembership[] = [];
      for (const m of memberships) {
        const teamSnap = await getDoc(teamDoc(m.teamId));
        if (teamSnap.exists()) {
          results.push({
            team: { id: teamSnap.id, ...(teamSnap.data() as Omit<Team, 'id'>) },
            membership: m,
          });
        }
      }
      onChange(results);
    },
    (err) => onError?.(err)
  );
}

/** Live list of all members of one team, ordered by join time. */
export function watchTeamMembers(
  teamId: string,
  onChange: (members: TeamMember[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    teamMembersCol(),
    where('teamId', '==', teamId),
    orderBy('joinedAt', 'asc')
  );

  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(docToMember)),
    (err) => onError?.(err)
  );
}

/** Live single-team subscription used by the details screen. */
export function watchTeam(
  teamId: string,
  onChange: (team: Team | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    teamDoc(teamId),
    (snap) => {
      if (!snap.exists()) return onChange(null);
      onChange({ id: snap.id, ...(snap.data() as Omit<Team, 'id'>) });
    },
    (err) => onError?.(err)
  );
}

// ------------------------------------------------------------------
// Update (leader only)
// ------------------------------------------------------------------

export async function updateTeam(
  teamId: string,
  fields: { name: string; description: string }
): Promise<void> {
  await updateDoc(teamDoc(teamId), {
    name: fields.name.trim(),
    description: fields.description.trim(),
    updatedAt: serverTimestamp(),
  });
}

// Re-export Timestamp for callers that want to display joinedAt etc.
export { Timestamp };
