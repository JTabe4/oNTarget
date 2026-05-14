/**
 * app/(tabs)/goals/_layout.tsx
 * ------------------------------------------------------------------
 * Stack navigator nested inside the Goals tab.  This lets us go:
 *
 *   List (index)  →  Create (new)
 *                 →  Details ([id])
 *
 * Each screen owns its own header title; the Tab bar itself stays
 * visible because this Stack is a *child* of the Tabs layout.
 */

import { Stack } from 'expo-router';

export default function GoalsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Goals' }} />
      <Stack.Screen name="new" options={{ title: 'New Goal', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Goal' }} />
    </Stack>
  );
}
