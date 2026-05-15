/**
 * app/(tabs)/teams/join.tsx
 * ------------------------------------------------------------------
 * Enter an invite code to join an existing team.  After success we
 * navigate to the team's details screen.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { joinTeamByInviteCode } from '@/firebase/teams';

export default function JoinTeamScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!user || !userProfile) {
      setError('You must be signed in.');
      return;
    }
    if (!code.trim()) {
      setError('Enter an invite code.');
      return;
    }

    try {
      setSubmitting(true);
      const teamId = await joinTeamByInviteCode(code, user.uid, userProfile.username);
      router.replace(`/(tabs)/teams/${teamId}`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not join team.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.label}>Invite code</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. AB23CD"
          placeholderTextColor="#8A8A8A"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Join team</Text>
          )}
        </Pressable>

        <Text style={styles.helper}>
          Ask the Team Leader for an invite code if you don&apos;t have one.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20 },
  label: { fontSize: 13, color: '#444', fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    color: '#111',
    backgroundColor: '#fff',
    letterSpacing: 2,
    textAlign: 'center',
  },
  error: { color: '#d4351c', marginTop: 12 },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  helper: { color: '#666', fontSize: 13, marginTop: 16, lineHeight: 19 },
});
