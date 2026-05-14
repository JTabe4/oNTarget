/**
 * app/_layout.tsx
 * ------------------------------------------------------------------
 * Root layout for Expo Router.
 *
 * Responsibilities:
 *   1. Provide global app state (AuthProvider, theme provider).
 *   2. Decide whether to render an auth screen or the main tabs based
 *      on the current Firebase session.
 *
 * How protected routing works here
 * --------------------------------
 * Expo Router renders the file tree, and every navigation goes
 * through this root layout.  We use a small helper component
 * (`<RouteGuard>`) that:
 *   - waits until `useAuth().loading` flips to false
 *   - if the user is logged in but currently inside (auth), redirect
 *     to (tabs)
 *   - if the user is signed out but currently inside (tabs), redirect
 *     to (auth)/login
 *
 * The actual screens are mounted by `<Stack>`; the guard only
 * controls *which* group is allowed for the current auth state.
 */

import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // `segments` is e.g. ["(tabs)", "index"], ["(auth)", "login"], or
    // ["complete-profile"] for the top-level profile-completion screen.
    const firstSeg = segments[0];
    const inAuthGroup = firstSeg === '(auth)';
    const onCompleteProfile = firstSeg === 'complete-profile';

    if (!user) {
      // Signed-out users belong in (auth).
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (!userProfile) {
      // Signed in but no Firestore profile yet — happens for legacy
      // accounts created before username support, or if a previous
      // signup attempt failed between auth-create and profile-write.
      if (!onCompleteProfile) router.replace('/complete-profile');
      return;
    }

    // Fully set up: kick them into the tabs if they're loitering on
    // any "pre-auth" screen.
    if (inAuthGroup || onCompleteProfile) {
      router.replace('/(tabs)');
    }
  }, [user, userProfile, loading, segments, router]);

  // While Firebase is restoring the session from AsyncStorage, show a
  // simple spinner so we don't flash the wrong screen.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RouteGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="complete-profile" />
          </Stack>
        </RouteGuard>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
