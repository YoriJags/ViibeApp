/**
 * GPSLockIndicator Component
 * 
 * Shows the GPS verification status with animated visual feedback.
 * Displays a pulsing green ring when the user is within the geofence.
 * 
 * UI ANIMATION REFINEMENT NOTES:
 * ================================
 * 1. The pulse animation uses react-native-reanimated for 60fps performance
 * 2. Consider adding haptic feedback when GPS locks (expo-haptics)
 * 3. The glow effect can be enhanced with react-native-svg for gradient rings
 * 4. Add a "scanning" animation state while acquiring GPS
 * 5. Consider adding a sound effect on successful lock
 * 
 * @example
 * <GPSLockIndicator
 *   isLocked={true}
 *   isChecking={false}
 *   distance={25}
 *   maxDistance={50}
 * />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';

interface GPSLockIndicatorProps {
  isLocked: boolean;
  isChecking?: boolean;
  distance?: number;      // Current distance in meters
  maxDistance?: number;   // Geofence radius in meters
  onRetry?: () => void;
}

export const GPSLockIndicator: React.FC<GPSLockIndicatorProps> = ({
  isLocked,
  isChecking = false,
  distance,
  maxDistance = 50,
  onRetry,
}) => {
  // ========================================
  // UI ANIMATION: Pulse Animation
  // ----------------------------------------
  // This creates the pulsing green ring effect.
  // For enhanced UX, consider:
  // - Using spring animations for more natural feel
  // - Adding multiple concentric rings
  // - Implementing a particle effect on lock
  // ========================================
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLocked) {
      // Start pulse animation when GPS is locked
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow fade-in animation
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      // Reset animations when not locked
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isLocked]);

  useEffect(() => {
    if (isChecking) {
      // Scanning animation (rotating scan line)
      Animated.loop(
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      scanAnim.setValue(0);
    }
  }, [isChecking]);

  // Interpolate glow color
  const glowBackgroundColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(76, 175, 80, 0)', 'rgba(76, 175, 80, 0.15)'],
  });

  // Calculate progress if distance is provided
  const progress = distance && maxDistance 
    ? Math.max(0, Math.min(1, 1 - distance / maxDistance))
    : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: glowBackgroundColor },
      ]}
    >
      <View style={styles.content}>
        {/* Icon with Pulse Effect */}
        <Animated.View
          style={[
            styles.iconWrapper,
            { transform: [{ scale: isLocked ? pulseAnim : 1 }] },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              isLocked ? styles.iconContainerLocked : styles.iconContainerUnlocked,
            ]}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={isLocked ? 'location' : 'location-outline'}
                size={24}
                color={isLocked ? colors.status.success : colors.text.muted}
              />
            )}
          </View>

          {/* ========================================
              UI ANIMATION: Outer Ring Glow
              ----------------------------------------
              This is the green ring that pulses.
              Enhancement ideas:
              - Use SVG circle with strokeDasharray for progress
              - Add gradient stroke using react-native-svg
              - Implement ripple effect on lock
              ======================================== */}
          {isLocked && (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.3],
                    outputRange: [0.8, 0],
                  }),
                },
              ]}
            />
          )}
        </Animated.View>

        {/* Status Text */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: isLocked ? colors.status.success : colors.text.secondary },
            ]}
          >
            {isChecking
              ? 'Verifying location...'
              : isLocked
              ? 'GPS Locked - Ready to Rate!'
              : 'Get closer to unlock rating'}
          </Text>
          <Text style={styles.subtitle}>
            {isLocked
              ? "You're verified at this venue"
              : distance
              ? `${Math.round(distance)}m away (need < ${maxDistance}m)`
              : `Must be within ${maxDistance}m of venue`}
          </Text>
        </View>

        {/* Checking Indicator */}
        {isChecking && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </View>

      {/* Progress Bar (optional) */}
      {distance !== undefined && !isLocked && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  iconWrapper: {
    position: 'relative',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  iconContainerLocked: {
    backgroundColor: colors.status.success + '20',
    borderColor: colors.status.success,
  },
  iconContainerUnlocked: {
    backgroundColor: colors.background.input,
    borderColor: colors.border,
  },
  pulseRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: colors.status.success,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.background.input,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.status.success,
    borderRadius: 2,
  },
});

export default GPSLockIndicator;
