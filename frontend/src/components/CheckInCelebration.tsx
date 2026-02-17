/**
 * CheckInCelebration - Confetti burst + clout earned overlay
 *
 * Triggered after ghost check-in or rating submission.
 * Particle burst (30 dots) + central emoji + clout counter.
 * Auto-dismisses after 2.5s.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PARTICLE_COUNT = 30;
const COLORS = ['#FF3366', '#FF6B35', '#FFD700', '#00E676', '#00D4FF', '#9933FF', '#FF69B4'];

interface CheckInCelebrationProps {
  visible: boolean;
  cloutEarned?: number;
  emoji?: string;
  onComplete: () => void;
}

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
  targetX: number;
  targetY: number;
  size: number;
}

export default function CheckInCelebration({
  visible,
  cloutEarned = 20,
  emoji = '\u{1F525}',
  onComplete,
}: CheckInCelebrationProps) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const cloutOpacity = useRef(new Animated.Value(0)).current;
  const cloutTranslateY = useRef(new Animated.Value(20)).current;

  const particles: Particle[] = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      targetX: (Math.random() - 0.5) * SCREEN_W * 0.8,
      targetY: (Math.random() - 0.5) * SCREEN_H * 0.5,
      size: 6 + Math.random() * 10,
    })),
  []);

  useEffect(() => {
    if (!visible) return;

    // Reset all
    overlayOpacity.setValue(0);
    emojiScale.setValue(0);
    cloutOpacity.setValue(0);
    cloutTranslateY.setValue(20);
    particles.forEach(p => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.scale.setValue(0);
      p.opacity.setValue(1);
    });

    // 1. Flash overlay
    Animated.timing(overlayOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    // 2. Particle burst
    const particleAnims = particles.map((p, i) =>
      Animated.sequence([
        Animated.delay(i * 15),
        Animated.parallel([
          Animated.spring(p.scale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
          Animated.timing(p.x, { toValue: p.targetX, duration: 700, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: p.targetY, duration: 700, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        ]),
      ])
    );

    // 3. Emoji pop
    Animated.sequence([
      Animated.delay(100),
      Animated.spring(emojiScale, { toValue: 1, tension: 80, friction: 5, useNativeDriver: true }),
    ]).start();

    // 4. Clout counter float up
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(cloutOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(cloutTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    // Fire particles
    Animated.parallel(particleAnims).start();

    // 5. Fade out and dismiss
    const timer = setTimeout(() => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        onComplete();
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
      {/* Confetti particles */}
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale: p.scale },
              ],
              opacity: p.opacity,
            },
          ]}
        />
      ))}

      {/* Central emoji */}
      <Animated.Text style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}>
        {emoji}
      </Animated.Text>

      {/* Clout earned */}
      <Animated.View
        style={[
          styles.cloutBadge,
          {
            opacity: cloutOpacity,
            transform: [{ translateY: cloutTranslateY }],
          },
        ]}
      >
        <Text style={styles.cloutText}>+{cloutEarned} Clout</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.6)',
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
  },
  emoji: {
    fontSize: 72,
  },
  cloutBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(255,51,102,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF336650',
  },
  cloutText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
  },
});
