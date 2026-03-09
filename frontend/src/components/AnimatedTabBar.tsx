/**
 * AnimatedTabBar — Luxury Edition
 * Premium dark glass bar with pill-active-state, editorial labels, refined glow.
 * Floor-aware: accepts glowColor per floor (pink / gold / blue).
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

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
  glowColor: string;
  backgroundColor?: string;
  inactiveColor?: string;
  tabs: TabItem[];
}

export const AnimatedTabBar: React.FC<AnimatedTabBarProps> = ({
  state,
  navigation,
  glowColor,
  inactiveColor = '#4A4A5A',
  tabs,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const tabWidth = screenWidth / tabs.length;

  const setTabBarHidden = useVibeStore(s => s.setTabBarHidden);

  // Always ensure tab bar is visible on mount
  const slideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setTabBarHidden(false);
  }, []);

  // Pill indicator slides under the active tab
  const pillAnim = useRef(new Animated.Value(0)).current;
  // Scale & opacity per icon
  const scaleAnims = useRef(tabs.map(() => new Animated.Value(1))).current;
  const glowAnims = useRef(tabs.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: state.index * tabWidth,
      tension: 70,
      friction: 12,
      useNativeDriver: true,
    }).start();

    tabs.forEach((_, idx) => {
      const isFocused = idx === state.index;
      Animated.parallel([
        Animated.spring(scaleAnims[idx], {
          toValue: isFocused ? 1.18 : 1,
          tension: 90,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnims[idx], {
          toValue: isFocused ? 1 : 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [state.index]);

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      {/* Decorative nub */}
      <View style={styles.collapseHandle}>
        <View style={[styles.collapseNub, { backgroundColor: glowColor + '60' }]} />
      </View>

      <BlurView intensity={60} tint="dark" style={styles.blur}>
        {/* Top hairline */}
        <View style={styles.topBorder} />

        {/* Active pill — slides behind the active icon */}
        <Animated.View
          style={[
            styles.activePill,
            {
              width: tabWidth * 0.5,
              left: tabWidth * 0.25,
              transform: [{ translateX: pillAnim }],
              backgroundColor: glowColor + '18',
              borderColor: glowColor + '30',
            },
          ]}
        />

        <View style={styles.row}>
          {tabs.map((tab, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[index]?.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(state.routes[index]?.name);
              }
            };

            return (
              <TouchableOpacity
                key={tab.name}
                onPress={onPress}
                style={styles.tab}
                activeOpacity={0.75}
              >
                {/* Icon with glow halo */}
                <Animated.View
                  style={[
                    styles.iconWrap,
                    {
                      transform: [{ scale: scaleAnims[index] }],
                      shadowColor: glowColor,
                      shadowOpacity: glowAnims[index] as any,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 0 },
                    },
                  ]}
                >
                  <Ionicons
                    name={isFocused ? tab.iconFocused : tab.icon}
                    size={22}
                    color={isFocused ? glowColor : inactiveColor}
                  />
                </Animated.View>

                {/* Label */}
                <Animated.Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? glowColor : inactiveColor,
                      opacity: glowAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 1],
                      }),
                      fontWeight: isFocused ? '700' : '500',
                      letterSpacing: isFocused ? 0.8 : 0.3,
                    },
                  ]}
                >
                  {tab.label.toUpperCase()}
                </Animated.Text>

                {/* Active dot beneath label */}
                {isFocused && (
                  <View style={[styles.activeDot, { backgroundColor: glowColor }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  collapseHandle: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  collapseNub: {
    width: 36,
    height: 3,
    borderRadius: 2,
  },
  blur: {
    overflow: 'hidden',
  },
  topBorder: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  activePill: {
    position: 'absolute',
    top: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 0.5,
    zIndex: 0,
  },
  row: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    backgroundColor: 'rgba(8, 8, 18, 0.72)',
    position: 'relative',
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 28,
  },
  label: {
    fontSize: 9,
    marginTop: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});

export default AnimatedTabBar;
