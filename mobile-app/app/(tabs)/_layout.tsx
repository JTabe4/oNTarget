/**
 * app/(tabs)/_layout.tsx
 * ------------------------------------------------------------------
 * The tab bar visible to authenticated users.  The root RouteGuard
 * makes sure nobody reaches this group without a signed-in Firebase
 * user, so children don't need to re-check auth themselves.
 *
 * We use MaterialIcons directly here (rather than the IconSymbol
 * helper) so adding more tabs later doesn't require also editing the
 * SF-Symbol → Material-Icon mapping table.
 */

import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="flag" color={color} />,
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams',
          // MaterialIcons icon name "groups" is just a generic people
          // glyph — user-facing label is still "Teams".
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="groups" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
