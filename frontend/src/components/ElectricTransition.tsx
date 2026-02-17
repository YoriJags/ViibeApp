/**
 * ElectricTransition - Animated neon wipe effect between screens
 *
 * Renders a full-screen gradient wipe that plays on mount.
 * Use as an overlay during navigation or mode switches.
 * Three modes: 'wipe' (left-to-right), 'flash' (center burst), 'pulse' (radial).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface ElectricTransitionProps {
  visible: boolean;
  mode?: 'wipe' | 'flash' | 'pulse';
  color?: string;
  duration?: number;
  onComplete?: () => void;
}

export default function ElectricTransition({
  visible,
  mode = 'wipe',
  color = '#FF3366',
  duration = 600,
  onComplete,
}: ElectricTransitionProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }

    if (mode === 'wipe') {
      progress.setValue(-SCREEN_W);
      opacity.setValue(1);
      Animated.sequence([
        Animated.timing(progress, { toValue: SCREEN_W, duration, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onComplete?.());
    } else if (mode === 'flash') {
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: duration, useNativeDriver: true }),
      ]).start(() => onComplete?.());
    } else if (mode === 'pulse') {
      scale.setValue(0.3);
      opacity.setValue(0.7);
      Animated.parallel([
        Animated.timing(scale, { toValue: 3, duration, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }),
      ]).start(() => onComplete?.());
    }
  }, [visible]);

  if (!visible) return null;

  if (mode === 'wipe') {
    return (
      <Animated.View
        style={[styles.overlay, { opacity }]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.wipeBar, { transform: [{ translateX: progress }] }]}>
          <LinearGradient
            colors={['transparent', color, color, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.wipeGradient}
          />
        </Animated.View>
      </Animated.View>
    );
  }

  if (mode === 'flash') {
    return (
      <Animated.View
        style={[styles.overlay, { opacity, backgroundColor: color }]}
        pointerEvents="none"
      />
    );
  }

  // pulse
  return (
    <Animated.View
      style={[
        styles.pulseCircle,
        {
          opacity,
          backgroundColor: color + '40',
          transform: [{ scale }],
        },
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  wipeBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_W * 0.4,
  },
  wipeGradient: {
    flex: 1,
  },
  pulseCircle: {
    position: 'absolute',
    top: SCREEN_H / 2 - 50,
    left: SCREEN_W / 2 - 50,
    width: 100,
    height: 100,
    borderRadius: 50,
    zIndex: 9999,
  },
});
