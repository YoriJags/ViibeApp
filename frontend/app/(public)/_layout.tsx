/**
 * PUBLIC FLOOR - Layout
 * The Social Experience - Neon/Midnight Theme
 *
 * Navigation: Map | Trending | Lobby | Profile
 * Access: All users (default entry point)
 *
 * Features: Custom AnimatedTabBar with neon pink glow
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { publicTheme } from '../../src/theme/floors';
import { AnimatedTabBar } from '../../src/components/AnimatedTabBar';

const { colors } = publicTheme;

const PUBLIC_TABS = [
  { name: 'index', label: 'Map', icon: 'map-outline' as const, iconFocused: 'map' as const },
  { name: 'trending', label: 'Trending', icon: 'flame-outline' as const, iconFocused: 'flame' as const },
  { name: 'lobby', label: 'Lobby', icon: 'bookmark-outline' as const, iconFocused: 'bookmark' as const },
  { name: 'profile', label: 'Profile', icon: 'person-outline' as const, iconFocused: 'person' as const },
];

export default function PublicLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => (
        <AnimatedTabBar
          {...props}
          glowColor={colors.primary}
          inactiveColor={colors.text.muted}
          tabs={PUBLIC_TABS}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trending" />
      <Tabs.Screen name="lobby" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
