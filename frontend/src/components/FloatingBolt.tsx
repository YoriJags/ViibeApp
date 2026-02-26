import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type BoltOrigin = 'self' | 'other';

interface FloatingBoltProps {
  id: string;
  color: string;
  origin: BoltOrigin;
  startX: number;
  onDone: (id: string) => void;
}

/**
 * A single ⚡ bolt that shoots upward and fades out.
 * Spawned per tap — multiple can animate simultaneously.
 * Self-bolts rise from center; other-scouts' bolts drift in from sides.
 */
export default function FloatingBolt({ id, color, origin, startX, onDone }: FloatingBoltProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(origin === 'self' ? 1.2 : 0.9)).current;

  // Slight random horizontal drift
  const driftX = useRef(
    new Animated.Value(startX + (Math.random() - 0.5) * 40)
  ).current;

  useEffect(() => {
    const duration = origin === 'self' ? 900 : 1100;
    const rise = origin === 'self' ? -180 : -140;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: rise,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 0.6,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => onDone(id));
  }, []);

  return (
    <Animated.Text
      style={[
        styles.bolt,
        {
          color,
          transform: [{ translateY }, { translateX: driftX }, { scale }],
          opacity,
          textShadowColor: color,
        },
      ]}
    >
      ⚡
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  bolt: {
    position: 'absolute',
    fontSize: 28,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    pointerEvents: 'none',
  },
});
