/**
 * VibeMeter Component
 * 
 * A visual indicator of a venue's current vibe score.
 * Can be used in list items, cards, or detail views.
 * 
 * Features:
 * - Animated score display
 * - Color gradient based on vibe level
 * - Velocity indicator (heating up/cooling down)
 * - Optional compact mode for list items
 * 
 * @example
 * <VibeMeter
 *   score={85}
 *   velocity="heating_up"
 *   size="large"
 *   showLabel={true}
 * />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, getVibeColor } from '../theme';

interface VibeMeterProps {
  score: number;
  velocity?: 'heating_up' | 'cooling_down' | 'stable';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showVelocity?: boolean;
  animated?: boolean;
}

export const VibeMeter: React.FC<VibeMeterProps> = ({
  score,
  velocity = 'stable',
  size = 'medium',
  showLabel = true,
  showVelocity = true,
  animated = true,
}) => {
  const animatedScore = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedScore, {
        toValue: score,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [score]);

  useEffect(() => {
    if (velocity === 'heating_up' && animated) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [velocity]);

  const vibeColor = getVibeColor(score);

  const getVelocityIcon = () => {
    switch (velocity) {
      case 'heating_up':
        return { name: 'trending-up', color: colors.status.success };
      case 'cooling_down':
        return { name: 'trending-down', color: colors.status.error };
      default:
        return { name: 'remove', color: colors.text.muted };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.containerSmall,
          score: styles.scoreSmall,
          label: styles.labelSmall,
        };
      case 'large':
        return {
          container: styles.containerLarge,
          score: styles.scoreLarge,
          label: styles.labelLarge,
        };
      default:
        return {
          container: styles.containerMedium,
          score: styles.scoreMedium,
          label: styles.labelMedium,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const velocityIcon = getVelocityIcon();

  const displayScore = animated
    ? animatedScore.interpolate({
        inputRange: [0, 100],
        outputRange: ['0', '100'],
        extrapolate: 'clamp',
      })
    : Math.round(score).toString();

  return (
    <Animated.View
      style={[
        styles.container,
        sizeStyles.container,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {/* Score */}
      <View style={styles.scoreContainer}>
        {animated ? (
          <Animated.Text style={[sizeStyles.score, { color: vibeColor }]}>
            {displayScore}
          </Animated.Text>
        ) : (
          <Text style={[sizeStyles.score, { color: vibeColor }]}>
            {Math.round(score)}
          </Text>
        )}
      </View>

      {/* Label */}
      {showLabel && (
        <Text style={sizeStyles.label}>Vibe Score</Text>
      )}

      {/* Velocity Indicator */}
      {showVelocity && velocity !== 'stable' && (
        <View style={styles.velocityContainer}>
          <Ionicons
            name={velocityIcon.name as any}
            size={size === 'small' ? 12 : 16}
            color={velocityIcon.color}
          />
          <Text style={[styles.velocityText, { color: velocityIcon.color }]}>
            {velocity === 'heating_up' ? 'Heating Up' : 'Cooling Down'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerSmall: {
    padding: spacing.sm,
  },
  containerMedium: {
    padding: spacing.md,
  },
  containerLarge: {
    padding: spacing.xl,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreSmall: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.extrabold,
  },
  scoreMedium: {
    fontSize: typography.fontSize.hero,
    fontWeight: typography.fontWeight.black,
  },
  scoreLarge: {
    fontSize: typography.fontSize.giant,
    fontWeight: typography.fontWeight.black,
  },
  labelSmall: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  labelMedium: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  labelLarge: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  velocityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  velocityText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default VibeMeter;
