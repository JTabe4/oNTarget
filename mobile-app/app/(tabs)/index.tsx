/**
 * app/(tabs)/index.tsx — Home
 * ------------------------------------------------------------------
 * Default landing tab once a user is signed in.  Intentionally bare;
 * real home-feed content lands here later.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const { user, userProfile } = useAuth();
  // Prefer the username from Firestore; fall back to the auth email
  // for the brief window before the profile finishes loading.
  const displayName = userProfile?.username ?? user?.email ?? 'unknown';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>Signed in as {displayName}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 16 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
});
