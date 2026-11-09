/**
 * The tab bar. One for the whole app, built from src/theme/tokens.ts.
 *
 * Flat surface with a top hairline, outline icons, 12px sentence-case labels.
 * The active tab is cream (the one accent); nothing else is coloured. It
 * respects the home-indicator inset instead of a hard-coded bottom padding.
 * The props are unchanged so every layout keeps working; glowColor and
 * inactiveColor are accepted but no longer used (one look everywhere).
 */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVibeStore } from '../store/vibeStore';
import { color, icon, size, space, type } from '../theme/tokens';

interface TabItem {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
}

interface AnimatedTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  glowColor?: string;
  backgroundColor?: string;
  inactiveColor?: string;
  tabs: TabItem[];
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const AnimatedTabBar: React.FC<AnimatedTabBarProps> = ({ state, navigation, tabs }) => {
  const insets = useSafeAreaInsets();
  const setTabBarHidden = useVibeStore((s) => s.setTabBarHidden);
  useEffect(() => { setTabBarHidden(false); }, []);

  // `tabs` may be a filtered subset of the navigator's screens, so resolve by
  // route name, never by index.
  const focusedRouteName = state.routes[state.index]?.name;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.xs) }]}>
      {tabs.map((tab) => {
        const route = state.routes.find((r: any) => r.name === tab.name);
        const focused = focusedRouteName === tab.name;
        const onPress = () => {
          if (!route) return;
          Haptics.selectionAsync().catch(() => {});
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
        };
        const tint = focused ? color.ink : color.inkFaint;
        return (
          <Pressable key={tab.name} onPress={onPress} style={styles.item}
            accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={sentence(tab.label)}>
            <Ionicons name={focused ? tab.iconFocused : tab.icon} size={icon.lg} color={tint} />
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>{sentence(tab.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', backgroundColor: color.surface,
    borderTopWidth: 1, borderTopColor: color.line, paddingTop: space.xs,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: size.tabBar - space.xs, gap: 2 },
  label: { ...type.caption },
});

export default AnimatedTabBar;
