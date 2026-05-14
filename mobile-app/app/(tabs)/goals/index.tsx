/**
 * app/(tabs)/goals/index.tsx
 * ------------------------------------------------------------------
 * Goals list — real-time stream of the signed-in user's goals
 * (newest first, archived hidden by default).
 *
 * Why FlatList over ScrollView?
 *   Built-in virtualization keeps scrolling smooth as the list grows.
 */

import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { GoalCard } from '@/components/goal-card';
import { useUserGoals } from '@/hooks/use-user-goals';

export default function GoalsListScreen() {
  const router = useRouter();
  const { goals, loading, error } = useUserGoals();

  // Hide archived goals from the main list.  They're still in the
  // underlying snapshot if we ever want an "Archive" tab.
  const visibleGoals = useMemo(
    () => goals.filter((g) => g.status !== 'archived'),
    [goals]
  );

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
        <Text style={styles.errorText}>Could not load goals: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={visibleGoals}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GoalCard goal={item} onPress={() => router.push(`/(tabs)/goals/${item.id}`)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to create your first goal.
            </Text>
          </View>
        }
      />

      <Link href="/(tabs)/goals/new" asChild>
        <Pressable style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  listContent: { padding: 16, paddingBottom: 96 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#d4351c', textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingTop: 64 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptySubtitle: { fontSize: 14, color: '#666', marginTop: 4, textAlign: 'center' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
});
