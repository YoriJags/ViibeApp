/**
 * PulseRing - Reusable expanding ring animation
 * Concentric rings that scale out + fade (looping)
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface PulseRingProps {
  color: string;
  size: number;
  count?: number;
  speed?: number;
  style?: any;
}

export const PulseRing: React.FC<PulseRingProps> = ({
  color,
  size,
  count = 3,
  speed = 2000,
  style,
}) => {
  const rings = useRef(
    Array.from({ length: count }, () => ({
      scale: new Animated.Value(0.4),
      opacity: new Animated.Value(0.6),
    }))
  ).current;

  useEffect(() => {
    const animations = rings.map((ring, index) => {
      const delay = (speed / count) * index;

      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(ring.scale, {
              toValue: 2.2,
              duration: speed,
              useNativeDriver: true,
            }),
            Animated.timing(ring.opacity, {
              toValue: 0,
              duration: speed,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(ring.scale, {
              toValue: 0.4,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(ring.opacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    });

    animations.forEach((anim) => anim.start());

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [count, speed]);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {rings.map((ring, index) => (
        <Animated.View
          key={index}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
              transform: [{ scale: ring.scale }],
              opacity: ring.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
});

export default PulseRing;
