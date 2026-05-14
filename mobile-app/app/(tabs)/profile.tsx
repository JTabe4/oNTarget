/**
 * app/(tabs)/profile.tsx — Profile (placeholder)
 * ------------------------------------------------------------------
 * Shows the signed-in user's email and exposes a Logout button.
 * After logout, the AuthContext flips `user` back to null and the
 * RouteGuard kicks the user out to /(auth)/login automatically.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { user, userProfile, logOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    try {
      setBusy(true);
      await logOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Signed in as</Text>
        <Text style={styles.username}>{userProfile?.username ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log out</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 16 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 16 },
  username: { fontSize: 20, fontWeight: '600', marginTop: 4 },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  button: {
    marginTop: 32,
    backgroundColor: '#d4351c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
