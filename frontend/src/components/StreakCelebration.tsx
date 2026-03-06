/**
 * StreakCelebration — fires on streak milestones: 3, 7, 14, 30 days.
 * Flame ritual design. Auto-dismisses in 4s.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

const MILESTONES: Record<number, { label: string; tagline: string; color: string }> = {
  3:  { label: '3 NIGHTS',  tagline: 'You keep showing up.',       color: '#FF9933' },
  7:  { label: '7 NIGHTS',  tagline: 'A full week in the scene.',  color: '#FF6633' },
  14: { label: '14 NIGHTS', tagline: 'Two weeks deep.',             color: '#FF3366' },
  30: { label: '30 NIGHTS', tagline: 'The scene is yours.',         color: '#CC33FF' },
};

// 12 flame particles
const FLAMES = Array.from({ length: 12 }, (_, i) => ({
  x: (Math.random() - 0.5) * 160,
  delay: i * 60,
  size: 8 + Math.random() * 16,
}));

interface Props {
  visible: boolean;
  streakDays: number;
  onDismiss: () => void;
}

export default function StreakCelebration({ visible, streakDays, onDismiss }: Props) {
  const bgOpac   = useRef(new Animated.Value(0)).current;
  const fireScale= useRef(new Animated.Value(0.4)).current;
  const fireOpac = useRef(new Animated.Value(0)).current;
  const numScale = useRef(new Animated.Value(0.3)).current;
  const numOpac  = useRef(new Animated.Value(0)).current;
  const labelOp  = useRef(new Animated.Value(0)).current;
  const tagOp    = useRef(new Animated.Value(0)).current;
  const flameAnims = useRef(
    FLAMES.map(() => ({ y: new Animated.Value(0), o: new Animated.Value(0) }))
  ).current;

  // Find nearest milestone
  const milestone = [30, 14, 7, 3].find(m => streakDays >= m) ?? 3;
  const { label, tagline, color } = MILESTONES[milestone] ?? MILESTONES[3];

  useEffect(() => {
    if (!visible) return;

    bgOpac.setValue(0); fireScale.setValue(0.4); fireOpac.setValue(0);
    numScale.setValue(0.3); numOpac.setValue(0); labelOp.setValue(0); tagOp.setValue(0);
    flameAnims.forEach(f => { f.y.setValue(0); f.o.setValue(0); });

    // Haptics
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 450);

    // Bg
    Animated.timing(bgOpac, { toValue: 1, duration: 250, useNativeDriver: true }).start();

    // Flame particles rising
    FLAMES.forEach((_, i) => {
      setTimeout(() => {
        flameAnims[i].o.setValue(0.8);
        Animated.loop(Animated.parallel([
          Animated.timing(flameAnims[i].y, { toValue: 1, duration: 900 + i * 80, useNativeDriver: true }),
          Animated.timing(flameAnims[i].o, { toValue: 0, duration: 900 + i * 80, useNativeDriver: true }),
        ])).start();
      }, FLAMES[i].delay);
    });

    // Fire icon burst
    setTimeout(() => Animated.parallel([
      Animated.spring(fireScale, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
      Animated.timing(fireOpac, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(), 200);

    // Number stamp
    setTimeout(() => Animated.parallel([
      Animated.spring(numScale, { toValue: 1, tension: 220, friction: 5, useNativeDriver: true }),
      Animated.timing(numOpac, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(), 550);

    // Labels
    setTimeout(() => Animated.timing(labelOp, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 900);
    setTimeout(() => Animated.timing(tagOp,   { toValue: 1, duration: 350, useNativeDriver: true }).start(), 1200);

    // Fade out
    setTimeout(() => Animated.timing(bgOpac, { toValue: 0, duration: 600, useNativeDriver: true }).start(), 3300);

    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: bgOpac }]} pointerEvents="none">

        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0005' }]} />

        {/* Subtle color wash */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.06 }]} />

        {/* Flame particles rising from bottom */}
        <View style={styles.flameBase} pointerEvents="none">
          {FLAMES.map((flame, i) => (
            <Animated.View key={i} style={[styles.flameDot, {
              left: W / 2 + flame.x,
              width: flame.size, height: flame.size * 1.6,
              borderRadius: flame.size / 2,
              backgroundColor: color,
              transform: [{ translateY: flameAnims[i].y.interpolate({ inputRange: [0, 1], outputRange: [0, -220] }) }],
              opacity: flameAnims[i].o,
            }]} />
          ))}
        </View>

        <View style={styles.content}>
          {/* Fire icon */}
          <Animated.View style={[styles.iconWrap, {
            transform: [{ scale: fireScale }], opacity: fireOpac,
            shadowColor: color,
          }]}>
            <Ionicons name="flame" size={64} color={color} />
          </Animated.View>

          {/* Streak number */}
          <Animated.Text style={[styles.streakNum, {
            color,
            transform: [{ scale: numScale }],
            opacity: numOpac,
          }]}>
            {streakDays}
          </Animated.Text>

          {/* Milestone label */}
          <Animated.Text style={[styles.streakLabel, { color, opacity: labelOp }]}>
            {label} STREAK
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text style={[styles.tagline, { opacity: tagOp }]}>
            {tagline}
          </Animated.Text>
        </View>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flameBase:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 },
  flameDot:    { position: 'absolute', bottom: 0 },
  content:     { alignItems: 'center', gap: 6 },
  iconWrap:    { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 30, elevation: 10, marginBottom: 8 },
  streakNum:   { fontSize: 80, fontWeight: '900', lineHeight: 84, letterSpacing: -2 },
  streakLabel: { fontSize: 18, fontWeight: '900', letterSpacing: 3, marginTop: -4 },
  tagline:     { fontSize: 15, color: '#777', fontWeight: '500', marginTop: 10 },
});
