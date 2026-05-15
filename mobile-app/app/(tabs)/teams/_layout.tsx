/**
 * app/(tabs)/teams/_layout.tsx
 * ------------------------------------------------------------------
 * Nested stack inside the Teams tab:
 *
 *   List (index)  →  Create (new)   (modal)
 *                 →  Join   (join)  (modal)
 *                 →  Details ([id])
 */

import { Stack } from 'expo-router';

export default function TeamsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Teams' }} />
      <Stack.Screen name="new" options={{ title: 'New Team', presentation: 'modal' }} />
      <Stack.Screen name="join" options={{ title: 'Join Team', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Team' }} />
    </Stack>
  );
}
