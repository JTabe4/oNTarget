/**
 * app/complete-profile.tsx
 * ------------------------------------------------------------------
 * Shown to a signed-in user who is missing their Firestore profile.
 *
 * Two paths land here:
 *   1. Legacy accounts created before the username system existed.
 *   2. A signup that crashed between createUser and the profile write.
 *
 * The user picks a username and we call `setUsername` from
 * AuthContext, which runs the same atomic-uniqueness transaction
 * used during fresh signups.  Once the profile lands the RouteGuard
 * redirects the user to (tabs).
 *
 * A "Log out" link lets them escape if they ever get stuck (e.g.,
 * every desired username is taken).
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { validateUsername } from '@/context/AuthContext';

export default function CompleteProfileScreen() {
  const { user, setUsername, logOut } = useAuth();

  const [username, setUsernameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      await setUsername(username.trim());
      // Navigation handled by RouteGuard.
    } catch (e: any) {
      setError(e?.message ?? 'Unable to save username.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Pick a username</Text>
          <Text style={styles.subtitle}>
            This is how you&apos;ll appear inside oNTarget.
            {user?.email ? `\nLogged in as ${user.email}` : ''}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#8A8A8A"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            value={username}
            onChangeText={setUsernameInput}
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
              <Text style={styles.buttonText}>Save username</Text>
            )}
          </Pressable>

          <Pressable style={styles.logoutLink} onPress={logOut} disabled={submitting}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  error: { color: '#d4351c', marginBottom: 12 },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutLink: { marginTop: 24, alignItems: 'center' },
  logoutText: { color: '#666', fontSize: 14 },
});
