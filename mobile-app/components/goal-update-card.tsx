/**
 * components/goal-update-card.tsx
 * ------------------------------------------------------------------
 * Display one update in the feed.  Read-only.  Doesn't know anything
 * about the parent goal — receives a fully-resolved GoalUpdate.
 */

import { Image, StyleSheet, Text, View } from 'react-native';

import type { GoalUpdate } from '@/types/goalUpdate';

interface Props {
  update: GoalUpdate;
}

function formatWhen(update: GoalUpdate): string {
  if (!update.createdAt) return 'just now';
  const d = update.createdAt.toDate();
  // Compact-ish: "May 12, 2:35 PM"
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function GoalUpdateCard({ update }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.username}>{update.username}</Text>
        <Text style={styles.when}>{formatWhen(update)}</Text>
      </View>
      <Text style={styles.text}>{update.text}</Text>
      {update.imageUrl ? (
        <Image
          source={{ uri: update.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  username: { fontSize: 14, fontWeight: '600', color: '#111' },
  when: { fontSize: 12, color: '#666' },

  text: { fontSize: 15, color: '#222', lineHeight: 21 },

  image: {
    marginTop: 10,
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
});
