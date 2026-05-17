/**
 * app/(tabs)/goals/[id].tsx
 * ------------------------------------------------------------------
 * Goal details + inline edit.
 *
 * Two visual modes share one screen:
 *   - View  → read-only summary, "Update progress" widget, Edit/Archive buttons
 *   - Edit  → full form, Save/Cancel buttons
 *
 * Why inline instead of a separate /edit route?
 *   For MVP it keeps the file/route count down and avoids passing
 *   state between two screens.  If editing grows substantially we
 *   can split this file without changing the data layer.
 *
 * Data flow:
 *   - We fetch the goal once on mount (getGoal).
 *   - After every successful write we re-fetch so the screen stays
 *     in sync with the server-resolved timestamp etc.
 *   - The list screen is on a different stack and uses its own
 *     onSnapshot listener, which will reflect changes automatically.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { GoalUpdateCard } from '@/components/goal-update-card';
import { GoalUpdateComposer } from '@/components/goal-update-composer';
import { ProgressBar } from '@/components/progress-bar';
import { archiveGoal, getGoal, updateGoal, updateGoalProgress } from '@/firebase/goals';
import { getTeam } from '@/firebase/teams';
import { useGoalUpdates } from '@/hooks/use-goal-updates';
import {
  type Goal,
  type GoalEditableFields,
  type GoalVisibility,
  computeProgressPercent,
} from '@/types/goal';

const VISIBILITIES: { value: GoalVisibility; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'group', label: 'Group' },
  { value: 'coach_only', label: 'Coach only' },
  { value: 'public', label: 'Public' },
];

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

export default function GoalDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mode + form state
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Updates feed (separate subscription — see hooks/use-goal-updates).
  const { updates, loading: updatesLoading, error: updatesError } = useGoalUpdates(id);

  // Team name (only fetched if this is a team goal).  Cached locally
  // so we don't refetch on every render of the details screen.
  const [teamName, setTeamName] = useState<string | null>(null);

  // Quick-update widget (view mode)
  const [progressInput, setProgressInput] = useState('');

  // Form fields (edit mode)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [unit, setUnit] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState<GoalVisibility>('private');

  // Pull the goal once on mount + after writes.
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const fresh = await getGoal(id);
      setGoal(fresh);
      if (fresh) {
        setProgressInput(String(fresh.currentValue));
        setTitle(fresh.title);
        setDescription(fresh.description);
        setCategory(fresh.category);
        setTargetValue(String(fresh.targetValue));
        setCurrentValue(String(fresh.currentValue));
        setUnit(fresh.unit);
        setDeadline(fresh.deadline ? formatDate(fresh.deadline.toDate()) : '');
        setVisibility(fresh.visibility);
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load goal.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Whenever the goal lands, fetch the team name if it's a team goal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!goal?.teamId) {
        setTeamName(null);
        return;
      }
      try {
        const t = await getTeam(goal.teamId);
        if (!cancelled) setTeamName(t?.name ?? null);
      } catch {
        if (!cancelled) setTeamName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goal?.teamId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !goal) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Goal not found.'}</Text>
      </View>
    );
  }

  // ----------------------------------------------------------------
  // Action handlers
  // ----------------------------------------------------------------

  const handleQuickProgress = async () => {
    const next = Number(progressInput);
    if (!Number.isFinite(next) || next < 0) {
      Alert.alert('Invalid value', 'Current value must be zero or positive.');
      return;
    }
    try {
      setBusy(true);
      await updateGoalProgress(goal.id, next, goal.targetValue);
      await refresh();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    const target = Number(targetValue);
    const current = Number(currentValue);
    if (!title.trim()) return Alert.alert('Invalid', 'Title is required.');
    if (!Number.isFinite(target) || target <= 0)
      return Alert.alert('Invalid', 'Target must be a positive number.');
    if (!Number.isFinite(current) || current < 0)
      return Alert.alert('Invalid', 'Current must be zero or positive.');

    let parsedDeadline: Date | null = null;
    if (deadline.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
        return Alert.alert('Invalid', 'Deadline must be YYYY-MM-DD.');
      }
      const d = new Date(`${deadline.trim()}T00:00:00`);
      if (isNaN(d.getTime())) return Alert.alert('Invalid', 'Deadline is not a real date.');
      parsedDeadline = d;
    }

    const fields: GoalEditableFields = {
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
      setBusy(true);
      await updateGoal(goal.id, fields);
      await refresh();
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    Alert.alert('Archive goal?', 'You can still view archived goals later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            await archiveGoal(goal.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Archive failed', e?.message ?? 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  // Live preview percent in edit mode
  const editPreviewPercent = computeProgressPercent(
    Number(currentValue) || 0,
    Number(targetValue) || 0
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {editing ? (
        <>
          <Field label="Title">
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          </Field>
          <Field label="Description">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </Field>
          <Field label="Category">
            <TextInput style={styles.input} value={category} onChangeText={setCategory} />
          </Field>

          <View style={styles.row}>
            <Field label="Target" style={styles.flex1}>
              <TextInput
                style={styles.input}
                value={targetValue}
                onChangeText={setTargetValue}
                keyboardType="decimal-pad"
              />
            </Field>
            <Field label="Current" style={[styles.flex1, styles.gapLeft]}>
              <TextInput
                style={styles.input}
                value={currentValue}
                onChangeText={setCurrentValue}
                keyboardType="decimal-pad"
              />
            </Field>
            <Field label="Unit" style={[styles.flex1, styles.gapLeft]}>
              <TextInput style={styles.input} value={unit} onChangeText={setUnit} />
            </Field>
          </View>

          <Text style={styles.preview}>Progress preview: {editPreviewPercent}%</Text>

          <Field label="Deadline (YYYY-MM-DD, optional)">
            <TextInput
              style={styles.input}
              value={deadline}
              onChangeText={setDeadline}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="2026-12-31"
              placeholderTextColor="#8A8A8A"
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

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setEditing(false)}
              disabled={busy}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={handleSaveEdit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>{goal.title}</Text>
          {goal.category ? <Text style={styles.category}>{goal.category}</Text> : null}

          <View style={styles.progressBlock}>
            <ProgressBar percent={goal.progressPercent} height={10} />
            <View style={styles.progressMetaRow}>
              <Text style={styles.progressMeta}>
                {goal.currentValue} / {goal.targetValue} {goal.unit}
              </Text>
              <Text style={styles.progressMeta}>{goal.progressPercent}%</Text>
            </View>
          </View>

          {goal.description ? (
            <Text style={styles.description}>{goal.description}</Text>
          ) : null}

          <View style={styles.detailGrid}>
            <DetailRow
              label="Goal type"
              value={
                goal.ownerType === 'team'
                  ? `Team — ${teamName ?? 'loading…'}`
                  : 'Personal'
              }
            />
            <DetailRow label="Status" value={goal.status} />
            <DetailRow label="Visibility" value={goal.visibility} />
            <DetailRow label="Deadline" value={formatDate(goal.deadline?.toDate() ?? null)} />
            <DetailRow label="Created" value={formatDate(goal.createdAt?.toDate() ?? null)} />
            <DetailRow label="Updated" value={formatDate(goal.updatedAt?.toDate() ?? null)} />
          </View>

          <Text style={styles.sectionTitle}>Update progress</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flex1]}
              keyboardType="decimal-pad"
              value={progressInput}
              onChangeText={setProgressInput}
              placeholder="Current value"
              placeholderTextColor="#8A8A8A"
            />
            <Pressable
              style={[styles.button, styles.gapLeft, busy && styles.buttonDisabled]}
              onPress={handleQuickProgress}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Update</Text>
              )}
            </Pressable>
          </View>

          {/* Updates section — composer above the feed. */}
          <Text style={[styles.sectionTitle, styles.updatesHeader]}>Updates</Text>
          <GoalUpdateComposer goalId={goal.id} />

          {updatesLoading ? (
            <ActivityIndicator style={styles.updatesLoader} />
          ) : updatesError ? (
            <Text style={styles.errorText}>Could not load updates: {updatesError.message}</Text>
          ) : updates.length === 0 ? (
            <Text style={styles.emptyUpdates}>No updates yet. Be the first to post.</Text>
          ) : (
            <View>
              {updates.map((u) => (
                <GoalUpdateCard key={u.id} update={u} />
              ))}
            </View>
          )}

          <View style={[styles.actionsRow, styles.actionsRowSpaced]}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setEditing(true)}
              disabled={busy}
            >
              <Text style={styles.secondaryButtonText}>Edit goal</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.dangerButton]}
              onPress={handleArchive}
              disabled={busy}
            >
              <Text style={styles.buttonText}>Archive</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// Small helpers (kept local to avoid leaking trivial components into the components/ folder)
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#d4351c' },

  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  category: { fontSize: 14, color: '#666', marginTop: 4 },

  progressBlock: { marginTop: 20, marginBottom: 16 },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressMeta: { fontSize: 14, color: '#333' },

  description: { fontSize: 15, color: '#333', lineHeight: 21, marginBottom: 16 },

  detailGrid: { marginTop: 8, marginBottom: 24 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  detailLabel: { color: '#666', fontSize: 13 },
  detailValue: { color: '#111', fontSize: 13, fontWeight: '500' },

  sectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 8, color: '#444' },
  updatesHeader: { marginTop: 24 },
  updatesLoader: { marginVertical: 16 },
  emptyUpdates: { color: '#666', fontSize: 13, paddingVertical: 12, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1 },
  gapLeft: { marginLeft: 8 },

  field: { marginBottom: 14 },
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

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionsRowSpaced: { marginTop: 24 },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc' },
  secondaryButtonText: { color: '#333', fontSize: 15, fontWeight: '600' },
  dangerButton: { backgroundColor: '#d4351c' },
});
