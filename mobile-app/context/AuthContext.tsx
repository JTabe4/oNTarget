/**
 * context/AuthContext.tsx
 * ------------------------------------------------------------------
 * Global auth + profile state.
 *
 * What `useAuth()` exposes:
 *   user           → Firebase Auth user (or null)
 *   userProfile    → Firestore /users/{uid} doc (or null while loading
 *                    or for accounts that haven't claimed a username)
 *   loading        → true until we know the auth state and have tried
 *                    to load the profile
 *   signUp         → create auth account + claim a unique username
 *   logIn          → email/password sign-in
 *   logOut         → sign out
 *   setUsername    → claim a unique username for an authenticated
 *                    user who doesn't have a profile yet (used by the
 *                    "Complete profile" screen for legacy accounts)
 *
 * Username uniqueness — how it works
 * ----------------------------------
 * Firestore has no "unique index" feature, but document *IDs* are
 * unique by definition.  So we maintain a sibling collection:
 *
 *     usernames/{lowercase_username} → { uid }
 *
 * Claiming a username runs in a transaction:
 *   1. read /usernames/{lower}
 *   2. if it exists and is owned by someone else → throw
 *   3. write /usernames/{lower}  AND  /users/{uid} together
 *
 * Because step 2 sees a consistent snapshot and step 3 commits
 * atomically, two simultaneous signups can never both succeed.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';

import { auth, db } from '@/firebase/config';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Shape of the document at /users/{uid} in Firestore. */
export type UserProfile = {
  uid: string;
  username: string;       // display version (preserves the case the user typed)
  usernameLower: string;  // lowercase copy used by /usernames/{lower}
  email: string;
  createdAt: Timestamp | null;
};

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<User>;
  logIn: (email: string, password: string) => Promise<User>;
  logOut: () => Promise<void>;
  setUsername: (username: string) => Promise<void>;
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Allowed chars: letters, numbers, underscore, dot, hyphen. 2–20 long. */
const USERNAME_RE = /^[A-Za-z0-9_.-]{2,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Username is required.';
  if (!USERNAME_RE.test(trimmed)) {
    return 'Username must be 2–20 characters: letters, numbers, _ . -';
  }
  return null;
}

async function loadProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/**
 * Atomically claim a username for a user.
 *
 * Throws:
 *   - 'Username is already taken.' — someone else owns it
 *   - any Firestore error from the transaction
 */
async function claimUsername(
  uid: string,
  email: string,
  username: string
): Promise<UserProfile> {
  const display = username.trim();
  const lower = normalizeUsername(display);

  await runTransaction(db, async (tx) => {
    const usernameRef = doc(db, 'usernames', lower);
    const userRef = doc(db, 'users', uid);

    const usernameSnap = await tx.get(usernameRef);
    if (usernameSnap.exists()) {
      const ownerUid = (usernameSnap.data() as { uid?: string }).uid;
      // If somehow *this* user already owns it, allow re-claiming
      // (idempotent retry).  Otherwise reject.
      if (ownerUid !== uid) {
        throw new Error('Username is already taken.');
      }
    }

    tx.set(usernameRef, { uid });
    tx.set(userRef, {
      uid,
      username: display,
      usernameLower: lower,
      email,
      createdAt: serverTimestamp(),
    });
  });

  // Read back so we capture the resolved server timestamp.
  const profile = await loadProfile(uid);
  if (!profile) {
    throw new Error('Profile write succeeded but read-back failed.');
  }
  return profile;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (nextUser) {
        try {
          const profile = await loadProfile(nextUser.uid);
          setUserProfile(profile);
        } catch {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      loading,

      signUp: async (email, password, username) => {
        // Fast-fail: check uniqueness *before* creating the auth user
        // so we don't leave an orphan account on the easy/common
        // collision case.
        const lower = normalizeUsername(username);
        const existing = await getDoc(doc(db, 'usernames', lower));
        if (existing.exists()) {
          throw new Error('Username is already taken.');
        }

        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // claimUsername re-checks inside a transaction, so even if two
        // signups raced past the pre-check, only one will win here.
        const profile = await claimUsername(cred.user.uid, email, username);
        setUserProfile(profile);

        return cred.user;
      },

      logIn: async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
      },

      logOut: async () => {
        await signOut(auth);
      },

      setUsername: async (username) => {
        if (!user) {
          throw new Error('You must be signed in to set a username.');
        }
        const profile = await claimUsername(user.uid, user.email ?? '', username);
        setUserProfile(profile);
      },
    }),
    [user, userProfile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ------------------------------------------------------------------
// Hook
// ------------------------------------------------------------------
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
