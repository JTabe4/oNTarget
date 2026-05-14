/**
 * firebase/goalUpdates.ts
 * ------------------------------------------------------------------
 * Repository for the `goalUpdates/{updateId}` collection AND for
 * the matching images in Firebase Storage.
 *
 * Storage layout:
 *   goalUpdates/{userId}/{goalId}/{filename}
 *
 * Encoding ownership into the path lets the Storage Rules check
 * `request.auth.uid == userId` without an extra Firestore read.
 *
 * Why split the image upload from the doc write?
 *   - The composer can show distinct "Uploading image..." and
 *     "Posting..." states.
 *   - If the doc write fails after the upload, we still have the
 *     image and can retry the write.
 */

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/firebase/config';
import type { GoalUpdate } from '@/types/goalUpdate';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const goalUpdatesCol = () => collection(db, 'goalUpdates');

function docToUpdate(snap: QueryDocumentSnapshot<DocumentData>): GoalUpdate {
  return { id: snap.id, ...(snap.data() as Omit<GoalUpdate, 'id'>) };
}

/**
 * Convert a local file URI (e.g. file:///… from expo-image-picker)
 * into a Blob ready for Firebase Storage.
 *
 * Why XHR instead of fetch().blob()?
 *   On some React Native versions `fetch(uri).blob()` either hangs
 *   or returns an unusable blob.  The XHR-based pattern below is
 *   the canonical workaround documented by Firebase.
 */
async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Failed to read image data.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

function fileExtensionFromUri(uri: string): string {
  // Strip query string if any, then take chars after the last dot.
  const cleaned = uri.split('?')[0];
  const dot = cleaned.lastIndexOf('.');
  if (dot === -1) return 'jpg';
  const ext = cleaned.slice(dot + 1).toLowerCase();
  // Keep simple — anything weird falls back to jpg.
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'jpg';
}

// ------------------------------------------------------------------
// Image upload
// ------------------------------------------------------------------

/**
 * Upload an image picked from the user's library to Firebase
 * Storage.  Returns the public download URL.
 *
 * Callers should only invoke this after image-picker has returned
 * a non-cancelled URI.
 */
export async function uploadGoalUpdateImage(
  uri: string,
  userId: string,
  goalId: string
): Promise<string> {
  const blob = await uriToBlob(uri);
  const ext = fileExtensionFromUri(uri);
  const filename = `${Date.now()}.${ext}`;
  const path = `goalUpdates/${userId}/${goalId}/${filename}`;

  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob);
  return await getDownloadURL(ref);
}

// ------------------------------------------------------------------
// Create
// ------------------------------------------------------------------

/**
 * Persist a new goal update.  The caller is responsible for
 * uploading the image first (if any) and passing the resolved URL.
 *
 * Returns the newly-created document id.
 */
export async function createGoalUpdate(args: {
  goalId: string;
  userId: string;
  username: string;
  text: string;
  imageUrl: string | null;
}): Promise<string> {
  const ref = await addDoc(goalUpdatesCol(), {
    goalId: args.goalId,
    userId: args.userId,
    username: args.username,
    text: args.text.trim(),
    imageUrl: args.imageUrl,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ------------------------------------------------------------------
// Read (real-time)
// ------------------------------------------------------------------

/**
 * Live stream of updates for a single goal, newest first.
 *
 * Firestore will likely ask for a composite index on
 * (goalId ASC, createdAt DESC) the first time this query runs;
 * the console error includes a one-click "create index" link.
 */
export function watchGoalUpdates(
  goalId: string,
  onChange: (updates: GoalUpdate[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    goalUpdatesCol(),
    where('goalId', '==', goalId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(docToUpdate)),
    (err) => onError?.(err)
  );
}
