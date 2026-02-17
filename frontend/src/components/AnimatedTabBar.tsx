/**
 * AnimatedTabBar - Custom bottom tab bar with glow effects
 * Floor-aware: Accepts theme color to glow pink/gold/blue
 * Features: Sliding indicator, icon scale, glass background
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
import { neonGlow } from '../theme';

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
  backgroundColor = 'rgba(15, 15, 25, 0.85)',
  inactiveColor = '#666666',
  tabs,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const tabWidth = screenWidth / tabs.length;
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(tabs.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: state.index * tabWidth,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();

    scaleAnims.forEach((anim, idx) => {
      Animated.spring(anim, {
        toValue: idx === state.index ? 1.15 : 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    });
  }, [state.index]);

  return (
    <View style={styles.wrapper}>
      <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
        <View style={[styles.container, { backgroundColor }]}>
          {/* Sliding glow indicator */}
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth,
                transform: [{ translateX: indicatorAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.indicatorDot,
                { backgroundColor: glowColor },
                neonGlow(glowColor, 'strong'),
              ]}
            />
          </Animated.View>

          {/* Tab items */}
          {tabs.map((tab, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
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
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.iconContainer,
                    {
                      transform: [{ scale: scaleAnims[index] }],
                    },
                    isFocused && neonGlow(glowColor, 'soft'),
                  ]}
                >
                  <Ionicons
                    name={isFocused ? tab.iconFocused : tab.icon}
                    size={24}
                    color={isFocused ? glowColor : inactiveColor}
                  />
                </Animated.View>
                <Animated.Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? glowColor : inactiveColor,
                      fontWeight: isFocused ? '700' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Animated.Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  blurContainer: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  container: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  indicatorDot: {
    width: 32,
    height: 3,
    borderRadius: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 32,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.3,
  },
});

export default AnimatedTabBar;
