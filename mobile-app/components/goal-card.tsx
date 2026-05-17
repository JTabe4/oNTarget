/**
 * components/goal-card.tsx
 * ------------------------------------------------------------------
 * Row used by the goals list.  Owns its own visual layout but is
 * agnostic about navigation — the parent passes `onPress`.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Goal } from '@/types/goal';
import { ProgressBar } from '@/components/progress-bar';

interface Props {
  goal: Goal;
  onPress?: () => void;
}

function formatDeadline(goal: Goal): string {
  if (!goal.deadline) return 'No deadline';
  const d = goal.deadline.toDate();
  // YYYY-MM-DD — locale-independent, fine for MVP
  return d.toISOString().slice(0, 10);
}

function statusLabel(status: Goal['status']): { text: string; color: string } {
  switch (status) {
    case 'completed':
      return { text: 'Completed', color: '#2e7d32' };
    case 'archived':
      return { text: 'Archived', color: '#888' };
    case 'active':
    default:
      return { text: 'Active', color: '#0a7ea4' };
  }
}

export function GoalCard({ goal, onPress }: Props) {
  const status = statusLabel(goal.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {goal.title}
        </Text>
        <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
      </View>

      <View style={styles.subRow}>
        {goal.category ? <Text style={styles.category}>{goal.category}</Text> : null}
        {goal.ownerType === 'team' && goal.teamId ? (
          <Text style={styles.teamBadge}>TEAM</Text>
        ) : null}
      </View>

      <View style={styles.progressRow}>
        <ProgressBar percent={goal.progressPercent} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{goal.progressPercent}%</Text>
        <Text style={styles.meta}>{formatDeadline(goal)}</Text>
      </View>
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
  title: { fontSize: 17, fontWeight: '600', flex: 1, marginRight: 8, color: '#111' },
  status: { fontSize: 12, fontWeight: '600' },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 8 },
  category: { fontSize: 13, color: '#666' },
  teamBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0a7ea4',
    backgroundColor: '#e6f3f8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  progressRow: { marginTop: 12 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  meta: { fontSize: 12, color: '#666' },
});
