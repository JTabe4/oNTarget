/**
 * app/(tabs)/teams/index.tsx
 * ------------------------------------------------------------------
 * My Teams — real-time list of teams the user belongs to.
 * Action row at the top exposes both Create and Join, since the
 * page can be a user's first stop with zero teams.
 */

import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { TeamCard } from '@/components/team-card';
import { useUserTeams } from '@/hooks/use-user-teams';

export default function TeamsListScreen() {
  const router = useRouter();
  const { teams, loading, error } = useUserTeams();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load teams: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.actionRow}>
        <Link href="/(tabs)/teams/new" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>+ Create team</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/teams/join" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Join with code</Text>
          </Pressable>
        </Link>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={teams}
        keyExtractor={(t) => t.team.id}
        renderItem={({ item }) => (
          <TeamCard
            item={item}
            onPress={() => router.push(`/(tabs)/teams/${item.team.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>You&apos;re not on any teams yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a team and invite people with the code, or join a team using
              a code someone shared with you.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#d4351c', textAlign: 'center' },

  actionRow: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  secondaryButtonText: { color: '#0a7ea4', fontSize: 14, fontWeight: '600' },

  listContent: { padding: 16, paddingTop: 8, paddingBottom: 32 },

  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
