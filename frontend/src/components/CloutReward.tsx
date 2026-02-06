/**
 * CLOUT REWARD - Animated reward notification
 * 
 * Shows +5 Clout animation when user submits a Vibe Check
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCloutRewardMessage } from '../utils/vibeMaster';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CloutRewardProps {
  visible: boolean;
  onAnimationComplete?: () => void;
}

export default function CloutReward({ visible, onAnimationComplete }: CloutRewardProps) {
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const coinBounce = useRef(new Animated.Value(0)).current;
  const message = useRef(getCloutRewardMessage()).current;

  useEffect(() => {
    if (visible) {
      // Reset values
      translateY.setValue(-150);
      opacity.setValue(0);
      scale.setValue(0.5);
      coinBounce.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Coin bounce animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(coinBounce, {
            toValue: -10,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(coinBounce, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      ).start();

      // Auto dismiss after 3 seconds
      const timeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onAnimationComplete?.();
        });
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <View style={styles.card}>
        {/* Coin Icon */}
        <Animated.View 
          style={[
            styles.coinContainer,
            { transform: [{ translateY: coinBounce }] }
          ]}
        >
          <View style={styles.coinOuter}>
            <View style={styles.coinInner}>
              <Ionicons name="flame" size={24} color="#FFF" />
            </View>
          </View>
        </Animated.View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.cloutAmount}>+5 CLOUT</Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        {/* Sparkles */}
        <View style={styles.sparkleContainer}>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={[styles.sparkle, { top: 20, right: 10 }]}>⭐</Text>
          <Text style={[styles.sparkle, { bottom: 10, left: 10 }]}>💫</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  coinContainer: {
    marginRight: spacing.md,
  },
  coinOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  coinInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
  },
  content: {
    flex: 1,
  },
  cloutAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 16,
    top: -5,
    left: 20,
  },
});
