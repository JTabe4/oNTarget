/**
 * app/(auth)/_layout.tsx
 * ------------------------------------------------------------------
 * Layout for the unauthenticated section of the app.
 *
 * The parentheses around "auth" make this a *route group* — it
 * organizes files without showing up in the URL.  Anything inside
 * is reachable only while the user is signed out, because the root
 * layout's RouteGuard redirects authenticated users back to (tabs).
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
