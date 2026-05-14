/**
 * firebase/config.ts
 * ------------------------------------------------------------------
 * Central Firebase initialization for the oNTarget app.
 *
 * Uses the Firebase v10 **modular** SDK (tree-shakable functions
 * instead of the old namespace `firebase.auth()` style).
 *
 * Exports:
 *   - app:     the FirebaseApp instance (rarely used directly)
 *   - auth:    Firebase Authentication, configured to persist
 *              sessions to AsyncStorage so users stay logged in
 *              after closing the app
 *   - db:      Cloud Firestore (NoSQL database)
 *   - storage: Cloud Storage (for user-uploaded files/images)
 *
 * Configuration is read from `EXPO_PUBLIC_*` environment variables
 * defined in `.env`.  Expo automatically inlines any variable that
 * starts with `EXPO_PUBLIC_` at build time, so it is safe to use
 * from JS.  Firebase web-SDK keys are *not* secret — your real
 * security comes from Firestore / Storage security rules.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-ignore — getReactNativePersistence is exported at runtime but
  // is not in the public type definitions on every Firebase version.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------
// 1. Pull config from env vars.
// ---------------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ---------------------------------------------------------------
// 2. Initialize the app (avoid double-init during Fast Refresh).
// ---------------------------------------------------------------
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ---------------------------------------------------------------
// 3. Initialize Auth with AsyncStorage persistence.
//
//    `initializeAuth` can only be called ONCE per app.  After Fast
//    Refresh the call would throw, so we fall back to `getAuth`.
// ---------------------------------------------------------------
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

// ---------------------------------------------------------------
// 4. Other services.
// ---------------------------------------------------------------
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
