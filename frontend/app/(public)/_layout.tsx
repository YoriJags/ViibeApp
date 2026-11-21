/**
 * PUBLIC FLOOR - Layout
 * The Social Experience - Neon/Midnight Theme
 *
 * Navigation: Map | Tonight | Crew | Intel | Profile
 * Access: All users (default entry point)
 *
 * Features: Custom AnimatedTabBar with neon pink glow
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicTheme } from '../../src/theme/floors';
import { AnimatedTabBar } from '../../src/components/AnimatedTabBar';

const { colors } = publicTheme;

const TABS = [
  { name: 'index',    label: 'Map',      icon: 'compass-outline' as const,      iconFocused: 'compass' as const },
  { name: 'trending', label: 'Tonight',  icon: 'flame-outline' as const,         iconFocused: 'flame' as const },
  { name: 'crew',     label: 'Crew',     icon: 'people-outline' as const,        iconFocused: 'people' as const },
  { name: 'intel',    label: 'Intel',    icon: 'sparkles-outline' as const,      iconFocused: 'sparkles' as const },
  { name: 'profile',  label: 'Profile',  icon: 'person-outline' as const,        iconFocused: 'person' as const },
];
export default function PublicLayout() {
  // The tab bar grows by the phone's navigation-bar height, so every tab
  // screen gives up the same strip at the bottom. Each screen's own bottom
  // padding then still clears the bar, on three-button and gesture phones alike.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { paddingBottom: insets.bottom, backgroundColor: colors.background.dark },
      }}
      tabBar={(props) => (
        <AnimatedTabBar
          {...props}
          glowColor={colors.primary}
          inactiveColor={colors.text.muted}
          tabs={TABS}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trending" />
      <Tabs.Screen name="crew" />
      <Tabs.Screen name="intel" />
      <Tabs.Screen name="profile" />
      {/* Lobby kept as a push screen, not a tab — accessible from Profile */}
      <Tabs.Screen name="lobby" options={{ href: null }} />
    </Tabs>
  );
}
