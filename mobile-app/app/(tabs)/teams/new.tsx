/**
 * app/(tabs)/teams/new.tsx
 * ------------------------------------------------------------------
 * Form for creating a new team.  After successful create we replace
 * the modal with the new team's details screen so the leader can
 * immediately see and share the invite code.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { createTeam } from '@/firebase/teams';

export default function NewTeamScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!user || !userProfile) {
      setError('You must be signed in.');
      return;
    }
    if (!name.trim()) {
      setError('Team name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const teamId = await createTeam(
        { name, description },
        user.uid,
        userProfile.username
      );
      router.replace(`/(tabs)/teams/${teamId}`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create team.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Team name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Morning Runners"
          placeholderTextColor="#8A8A8A"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="What's this team about?"
          placeholderTextColor="#8A8A8A"
          value={description}
          onChangeText={setDescription}
          multiline
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
            <Text style={styles.buttonText}>Create team</Text>
          )}
        </Pressable>

        <Text style={styles.helper}>
          You&apos;ll automatically become the Team Leader. An invite code is
          generated for you to share.
        </Text>
      </ScrollView>
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
    padding: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
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
