/**
 * components/team-card.tsx
 * ------------------------------------------------------------------
 * Row used by the teams list.  Shows the team's name, description,
 * the current user's role, and the invite code (leader only).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TeamWithMembership } from '@/types/team';

interface Props {
  item: TeamWithMembership;
  onPress?: () => void;
}

function roleLabel(role: TeamWithMembership['membership']['role']): string {
  return role === 'team_leader' ? 'Team Leader' : 'Member';
}

export function TeamCard({ item, onPress }: Props) {
  const { team, membership } = item;
  const isLeader = membership.role === 'team_leader';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={[styles.role, isLeader && styles.roleLeader]}>
          {roleLabel(membership.role)}
        </Text>
      </View>

      {team.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {team.description}
        </Text>
      ) : null}

      {isLeader ? (
        <Text style={styles.invite}>
          Invite code: <Text style={styles.inviteCode}>{team.inviteCode}</Text>
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardPressed: { opacity: 0.85 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 17, fontWeight: '600', flex: 1, marginRight: 8, color: '#111' },
  role: { fontSize: 12, fontWeight: '600', color: '#666' },
  roleLeader: { color: '#0a7ea4' },

  description: { fontSize: 13, color: '#666', marginTop: 4, lineHeight: 18 },

  invite: { fontSize: 13, color: '#333', marginTop: 10 },
  inviteCode: { fontWeight: '700', letterSpacing: 1.5, color: '#0a7ea4' },
});
