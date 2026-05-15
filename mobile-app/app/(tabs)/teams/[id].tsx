/**
 * app/(tabs)/teams/[id].tsx
 * ------------------------------------------------------------------
 * Team details + members list.
 *
 * Two live subscriptions:
 *   - watchTeam(id)         → name/description/leader/invite code
 *   - watchTeamMembers(id)  → roster
 *
 * The current user's role is derived from the members list (find
 * the row where userId === auth.uid).  We render the invite code
 * only when the current user is the Team Leader.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { watchTeam } from '@/firebase/teams';
import { useTeamMembers } from '@/hooks/use-team-members';
import type { Team, TeamMember } from '@/types/team';

export default function TeamDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<Error | null>(null);

  const { members, loading: membersLoading, error: membersError } = useTeamMembers(id);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = watchTeam(
      id,
      (next) => {
        setTeam(next);
        setTeamLoading(false);
      },
      (err) => {
        setTeamError(err);
        setTeamLoading(false);
      }
    );
    return unsubscribe;
  }, [id]);

  if (teamLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (teamError || !team) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{teamError?.message ?? 'Team not found.'}</Text>
      </View>
    );
  }

  const myMembership: TeamMember | undefined = members.find((m) => m.userId === user?.uid);
  const isLeader = user?.uid === team.teamLeaderId;
  const myRoleLabel = isLeader
    ? 'Team Leader'
    : myMembership
      ? 'Member'
      : '—';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.name}>{team.name}</Text>
      {team.description ? <Text style={styles.description}>{team.description}</Text> : null}

      <View style={styles.row}>
        <DetailRow label="Team Leader" value={team.teamLeaderUsername} />
        <DetailRow label="Your role" value={myRoleLabel} />
      </View>

      {isLeader ? (
        <View style={styles.inviteBlock}>
          <Text style={styles.inviteLabel}>Invite code</Text>
          <Text style={styles.inviteCode}>{team.inviteCode}</Text>
          <Text style={styles.inviteHelp}>
            Share this code so others can join the team.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Members</Text>

      {membersLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : membersError ? (
        <Text style={styles.errorText}>Could not load members: {membersError.message}</Text>
      ) : members.length === 0 ? (
        <Text style={styles.emptyMembers}>No members yet.</Text>
      ) : (
        <View>
          {members.map((m) => {
            const memberIsLeader = m.userId === team.teamLeaderId;
            return (
              <View key={m.id} style={styles.memberRow}>
                <Text style={styles.memberName}>
                  {m.username}
                  {m.userId === user?.uid ? ' (you)' : ''}
                </Text>
                <Text
                  style={[styles.memberRole, memberIsLeader && styles.memberRoleLeader]}
                >
                  {memberIsLeader ? 'Team Leader' : 'Member'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#d4351c' },

  name: { fontSize: 26, fontWeight: '700', color: '#111' },
  description: { fontSize: 15, color: '#444', lineHeight: 21, marginTop: 8 },

  row: { marginTop: 20 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  detailLabel: { color: '#666', fontSize: 13 },
  detailValue: { color: '#111', fontSize: 13, fontWeight: '500' },

  inviteBlock: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f0f8fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbe6ef',
  },
  inviteLabel: { color: '#0a7ea4', fontSize: 12, fontWeight: '600' },
  inviteCode: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#0a7ea4',
    marginTop: 6,
  },
  inviteHelp: { color: '#444', fontSize: 13, marginTop: 8 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
    color: '#444',
  },
  loader: { marginVertical: 16 },
  emptyMembers: { color: '#666', fontSize: 13, paddingVertical: 12 },

  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  memberName: { fontSize: 15, color: '#111' },
  memberRole: { fontSize: 12, color: '#666', fontWeight: '500' },
  memberRoleLeader: { color: '#0a7ea4' },
});
