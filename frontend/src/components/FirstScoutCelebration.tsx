/**
 * FirstScoutCelebration — fires when you are the first person to check into a venue tonight.
 * Fast, sharp, stamp-based. "You set the scene."
 * Auto-dismisses in 3.5s.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

// 20 spark particles that shoot outward
const SPARKS = Array.from({ length: 20 }, (_, i) => ({
  angle: (i / 20) * 360,
  dist:  60 + Math.random() * 80,
  size:  2 + Math.random() * 4,
}));

interface Props {
  visible: boolean;
  venueName: string;
  onDismiss: () => void;
}

export default function FirstScoutCelebration({ visible, venueName, onDismiss }: Props) {
  const bgOpac    = useRef(new Animated.Value(0)).current;
  const stampScale= useRef(new Animated.Value(2.2)).current;
  const stampOpac = useRef(new Animated.Value(0)).current;
  const lineOpac  = useRef(new Animated.Value(0)).current;
  const venueOp   = useRef(new Animated.Value(0)).current;
  const venueTY   = useRef(new Animated.Value(12)).current;
  const tagOp     = useRef(new Animated.Value(0)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;
  const sparkAnims = useRef(
    SPARKS.map(() => ({ t: new Animated.Value(0), o: new Animated.Value(0) }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    bgOpac.setValue(0); stampScale.setValue(2.2); stampOpac.setValue(0);
    lineOpac.setValue(0); venueOp.setValue(0); venueTY.setValue(12);
    tagOp.setValue(0); overlayOp.setValue(0);
    sparkAnims.forEach(s => { s.t.setValue(0); s.o.setValue(0); });

    // Sharp double-tap haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 120);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 350);

    // Bg fade in
    Animated.timing(bgOpac, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    // Stamp: scale DOWN from large (punchy impact)
    setTimeout(() => Animated.parallel([
      Animated.spring(stampScale, { toValue: 1, tension: 300, friction: 6, useNativeDriver: true }),
      Animated.timing(stampOpac, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start(), 150);

    // Sparks burst
    setTimeout(() => {
      sparkAnims.forEach(s => {
        s.t.setValue(0); s.o.setValue(1);
        Animated.parallel([
          Animated.timing(s.t, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(s.o, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      });
    }, 200);

    // Underline
    setTimeout(() => Animated.timing(lineOpac, { toValue: 1, duration: 300, useNativeDriver: true }).start(), 500);

    // Venue name
    setTimeout(() => Animated.parallel([
      Animated.timing(venueOp, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(venueTY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start(), 700);

    // Tagline
    setTimeout(() => Animated.timing(tagOp, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 1050);

    // Fade out
    setTimeout(() => Animated.timing(bgOpac, { toValue: 0, duration: 600, useNativeDriver: true }).start(), 2800);

    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: bgOpac }]} pointerEvents="none">

        {/* Dark bg */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000014' }]} />

        {/* Horizontal scan lines for texture */}
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.scanLine, { top: `${10 + i * 14}%` as any }]} />
        ))}

        {/* Sparks from center */}
        <View style={styles.sparkOrigin} pointerEvents="none">
          {SPARKS.map((spark, i) => {
            const rad = (spark.angle * Math.PI) / 180;
            return (
              <Animated.View key={i} style={[styles.spark, {
                width: spark.size, height: spark.size, borderRadius: spark.size / 2,
                transform: [
                  { translateX: sparkAnims[i].t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * spark.dist] }) },
                  { translateY: sparkAnims[i].t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * spark.dist] }) },
                ],
                opacity: sparkAnims[i].o,
              }]} />
            );
          })}
        </View>

        <View style={styles.content}>
          {/* Crown icon */}
          <Animated.View style={{ transform: [{ scale: stampScale }], opacity: stampOpac, marginBottom: 8 }}>
            <Ionicons name="ribbon" size={40} color="#FFD700" />
          </Animated.View>

          {/* FIRST SCOUT stamp */}
          <Animated.Text style={[styles.stamp, { transform: [{ scale: stampScale }], opacity: stampOpac }]}>
            FIRST SCOUT
          </Animated.Text>

          {/* Underline */}
          <Animated.View style={[styles.underline, { opacity: lineOpac }]} />

          {/* Venue */}
          <Animated.Text style={[styles.venueName, { opacity: venueOp, transform: [{ translateY: venueTY }] }]}
            numberOfLines={1}>
            {venueName}
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text style={[styles.tagline, { opacity: tagOp }]}>
            You set the scene tonight
          </Animated.Text>
        </View>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanLine:    { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFFFFF05' },
  sparkOrigin: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 2, height: 2 },
  spark:       { position: 'absolute', backgroundColor: '#FFD700' },
  content:     { alignItems: 'center', gap: 8 },
  stamp:       { fontSize: 42, fontWeight: '900', color: '#FFD700', letterSpacing: 5, textShadowColor: '#FFD70066', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  underline:   { width: W * 0.55, height: 2, backgroundColor: '#FFD700', marginVertical: 6 },
  venueName:   { fontSize: 18, color: '#EEE', fontWeight: '700', letterSpacing: 0.5, maxWidth: W - 64, textAlign: 'center' },
  tagline:     { fontSize: 14, color: '#888', fontWeight: '500', letterSpacing: 0.5 },
});
