/**
 * app/(tabs)/goals/new.tsx
 * ------------------------------------------------------------------
 * Create-a-goal form.  After a successful write we pop back to the
 * list; the real-time listener will pick the new goal up on its own.
 *
 * MVP simplifications:
 *   - Deadline is a YYYY-MM-DD text input (no date picker dep yet).
 *   - Visibility uses a row of pressable pills, not a native picker.
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
import { createGoal } from '@/firebase/goals';
import {
  type GoalVisibility,
  type NewGoalInput,
  computeProgressPercent,
} from '@/types/goal';

const VISIBILITIES: { value: GoalVisibility; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'group', label: 'Group' },
  { value: 'coach_only', label: 'Coach only' },
  { value: 'public', label: 'Public' },
];

/** Accepts YYYY-MM-DD or empty.  Returns Date | null | 'invalid'. */
function parseDateInput(raw: string): Date | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'invalid';
  const d = new Date(`${trimmed}T00:00:00`);
  return isNaN(d.getTime()) ? 'invalid' : d;
}

export default function NewGoalScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('0');
  const [unit, setUnit] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState<GoalVisibility>('private');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview so users see what they're producing.
  const previewPercent = computeProgressPercent(
    Number(currentValue) || 0,
    Number(targetValue) || 0
  );

  const handleSubmit = async () => {
    setError(null);

    if (!user || !userProfile) {
      setError('You must be signed in.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const target = Number(targetValue);
    if (!Number.isFinite(target) || target <= 0) {
      setError('Target value must be a positive number.');
      return;
    }
    const current = Number(currentValue);
    if (!Number.isFinite(current) || current < 0) {
      setError('Current value must be zero or a positive number.');
      return;
    }
    const parsedDeadline = parseDateInput(deadline);
    if (parsedDeadline === 'invalid') {
      setError('Deadline must be in YYYY-MM-DD format.');
      return;
    }

    const input: NewGoalInput = {
      title,
      description,
      category,
      targetValue: target,
      currentValue: current,
      unit,
      deadline: parsedDeadline,
      visibility,
    };

    try {
      setSubmitting(true);
      await createGoal(input, user.uid, userProfile.username);
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save goal.');
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
        <Field label="Title">
          <TextInput
            style={styles.input}
            placeholder="Run a 5K"
            placeholderTextColor="#8A8A8A"
            value={title}
            onChangeText={setTitle}
          />
        </Field>

        <Field label="Description">
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Why this goal matters…"
            placeholderTextColor="#8A8A8A"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </Field>

        <Field label="Category">
          <TextInput
            style={styles.input}
            placeholder="Fitness, Reading, Learning…"
            placeholderTextColor="#8A8A8A"
            value={category}
            onChangeText={setCategory}
          />
        </Field>

        <View style={styles.row}>
          <Field label="Target" style={styles.flex1}>
            <TextInput
              style={styles.input}
              placeholder="5"
              placeholderTextColor="#8A8A8A"
              keyboardType="decimal-pad"
              value={targetValue}
              onChangeText={setTargetValue}
            />
          </Field>
          <Field label="Current" style={[styles.flex1, styles.gapLeft]}>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#8A8A8A"
              keyboardType="decimal-pad"
              value={currentValue}
              onChangeText={setCurrentValue}
            />
          </Field>
          <Field label="Unit" style={[styles.flex1, styles.gapLeft]}>
            <TextInput
              style={styles.input}
              placeholder="km"
              placeholderTextColor="#8A8A8A"
              value={unit}
              onChangeText={setUnit}
            />
          </Field>
        </View>

        <Text style={styles.preview}>Progress preview: {previewPercent}%</Text>

        <Field label="Deadline (YYYY-MM-DD, optional)">
          <TextInput
            style={styles.input}
            placeholder="2026-12-31"
            placeholderTextColor="#8A8A8A"
            value={deadline}
            onChangeText={setDeadline}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>

        <Field label="Visibility">
          <View style={styles.pillRow}>
            {VISIBILITIES.map((v) => (
              <Pressable
                key={v.value}
                onPress={() => setVisibility(v.value)}
                style={[styles.pill, visibility === v.value && styles.pillActive]}
              >
                <Text
                  style={[
                    styles.pillText,
                    visibility === v.value && styles.pillTextActive,
                  ]}
                >
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create goal</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Small inline helper component to label form fields consistently.
function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  flex1: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },
  field: { marginBottom: 14 },
  row: { flexDirection: 'row' },
  gapLeft: { marginLeft: 8 },
  label: { fontSize: 13, color: '#444', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  preview: { fontSize: 13, color: '#0a7ea4', marginTop: -4, marginBottom: 14 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  pillText: { color: '#333', fontSize: 13 },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  error: { color: '#d4351c', marginVertical: 8 },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
