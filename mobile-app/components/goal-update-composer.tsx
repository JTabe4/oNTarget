/**
 * components/goal-update-composer.tsx
 * ------------------------------------------------------------------
 * Multi-step form for posting a single update:
 *   1. type some text
 *   2. (optional) pick one image from the photo library
 *   3. tap Post → upload image (if any) → write Firestore doc
 *
 * State-machine summary:
 *   idle       → composing without an in-flight network call
 *   uploading  → image upload in progress
 *   posting    → doc write in progress
 *
 * We surface both phases so the user knows what they're waiting on.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/context/AuthContext';
import { createGoalUpdate, uploadGoalUpdateImage } from '@/firebase/goalUpdates';

type Phase = 'idle' | 'uploading' | 'posting';

interface Props {
  goalId: string;
  /** Called after a successful post — useful for analytics, scroll-to-top, etc. */
  onPosted?: () => void;
}

export function GoalUpdateComposer({ goalId, onPosted }: Props) {
  const { user, userProfile } = useAuth();

  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== 'idle';

  // --------------------------------------------------------------
  // Image picking
  // --------------------------------------------------------------
  const handlePickImage = async () => {
    setError(null);
    try {
      // expo-image-picker prompts the user for permission the first
      // time `launchImageLibraryAsync` runs on iOS, so we don't need
      // a separate request call.
      const result = await ImagePicker.launchImageLibraryAsync({
        // New API (SDK 51+): pass an array of media-type strings.
        // The old `MediaTypeOptions.Images` was deprecated.
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      setImageUri(asset.uri);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open photo library.');
    }
  };

  const handleRemoveImage = () => setImageUri(null);

  // --------------------------------------------------------------
  // Post
  // --------------------------------------------------------------
  const handleSubmit = async () => {
    setError(null);

    if (!user || !userProfile) {
      setError('You must be signed in to post.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Write something before posting.');
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        setPhase('uploading');
        imageUrl = await uploadGoalUpdateImage(imageUri, user.uid, goalId);
      }

      setPhase('posting');
      await createGoalUpdate({
        goalId,
        userId: user.uid,
        username: userProfile.username,
        text: trimmed,
        imageUrl,
      });

      // Reset.
      setText('');
      setImageUri(null);
      onPosted?.();
    } catch (e: any) {
      Alert.alert('Could not post update', e?.message ?? 'Please try again.');
    } finally {
      setPhase('idle');
    }
  };

  // --------------------------------------------------------------
  // Render
  // --------------------------------------------------------------
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Share an update on this goal…"
        placeholderTextColor="#8A8A8A"
        value={text}
        onChangeText={setText}
        multiline
        editable={!busy}
      />

      {imageUri && (
        <View style={styles.imagePreviewWrap}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          <Pressable
            style={styles.removeImageBtn}
            onPress={handleRemoveImage}
            disabled={busy}
          >
            <Text style={styles.removeImageText}>×</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.iconButton, busy && styles.disabled]}
          onPress={handlePickImage}
          disabled={busy}
        >
          <Text style={styles.iconButtonText}>{imageUri ? 'Change photo' : '+ Add photo'}</Text>
        </Pressable>

        <Pressable
          style={[styles.postButton, busy && styles.disabled]}
          onPress={handleSubmit}
          disabled={busy}
        >
          {busy ? (
            <View style={styles.postBusyRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.postButtonText}>
                {phase === 'uploading' ? 'Uploading…' : 'Posting…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 16,
  },
  input: {
    minHeight: 64,
    fontSize: 15,
    color: '#111',
    textAlignVertical: 'top',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  imagePreviewWrap: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: '#eee',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: { color: '#fff', fontSize: 18, lineHeight: 20, fontWeight: '600' },

  error: { color: '#d4351c', marginTop: 8, fontSize: 13 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  iconButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  iconButtonText: { color: '#0a7ea4', fontWeight: '600', fontSize: 14 },

  postButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 96,
  },
  postBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  disabled: { opacity: 0.6 },
});
