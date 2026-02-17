/**
 * RatePromptFAB - Pulsating map-pin button for rating nearby venues
 *
 * Creative pin design: gradient circle + dual neon glow rings +
 * floating venue label + pin tail. Bounces gently when idle.
 * Navigates to venue detail with auto-open rate modal on press.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const PIN_SIZE = 60;

interface RatePromptFABProps {
  venueId: string;
  venueName: string;
  visible: boolean;
}

export const RatePromptFAB: React.FC<RatePromptFABProps> = ({
  venueId,
  venueName,
  visible,
}) => {
  const router = useRouter();

  // Entrance
  const slideY = useRef(new Animated.Value(100)).current;
  const scaleEntrance = useRef(new Animated.Value(0.5)).current;

  // Pulse rings
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.6)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.6)).current;

  // Idle bounce
  const bounceY = useRef(new Animated.Value(0)).current;

  // Label show/hide
  const labelOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 100, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleEntrance, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }

    // === Entrance ===
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleEntrance, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    // === Pulse ring 1 ===
    const pulse1 = Animated.loop(
      Animated.parallel([
        Animated.timing(ring1Scale, { toValue: 1.4, duration: 1500, useNativeDriver: true }),
        Animated.timing(ring1Opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );

    // === Pulse ring 2 (staggered) ===
    const pulse2 = Animated.sequence([
      Animated.delay(500),
      Animated.loop(
        Animated.parallel([
          Animated.timing(ring2Scale, { toValue: 1.4, duration: 1500, useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      ),
    ]);

    // === Idle bounce ===
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue: -5, duration: 1200, useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );

    // === Label: show 3s, hide 5s, repeat ===
    const labelCycle = Animated.loop(
      Animated.sequence([
        Animated.timing(labelOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(labelOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(5000),
      ]),
    );

    pulse1.start();
    pulse2.start();
    bounce.start();
    // Show label initially then start cycle
    Animated.sequence([
      Animated.timing(labelOpacity, { toValue: 1, duration: 400, delay: 600, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(labelOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.delay(2000),
    ]).start(() => labelCycle.start());

    return () => {
      pulse1.stop();
      pulse2.stop();
      bounce.stop();
      labelCycle.stop();
    };
  }, [visible]);

  // Reset ring values each loop iteration
  useEffect(() => {
    if (!visible) return;
    const listener1 = ring1Opacity.addListener(({ value }) => {
      if (value <= 0.01) {
        ring1Scale.setValue(1);
        ring1Opacity.setValue(0.6);
      }
    });
    const listener2 = ring2Opacity.addListener(({ value }) => {
      if (value <= 0.01) {
        ring2Scale.setValue(1);
        ring2Opacity.setValue(0.6);
      }
    });
    return () => {
      ring1Opacity.removeListener(listener1);
      ring2Opacity.removeListener(listener2);
    };
  }, [visible]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/venue/[id]',
      params: { id: venueId, openRateModal: 'true' },
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateY: Animated.add(slideY, bounceY) },
            { scale: scaleEntrance },
          ],
        },
      ]}
    >
      {/* Floating venue label */}
      <Animated.View style={[styles.labelPill, { opacity: labelOpacity }]}>
        <Text style={styles.labelText} numberOfLines={1}>
          Rate {venueName}
        </Text>
        <View style={styles.labelArrow} />
      </Animated.View>

      {/* Pulse ring 1 */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            opacity: ring1Opacity,
            transform: [{ scale: ring1Scale }],
          },
        ]}
      />

      {/* Pulse ring 2 */}
      <Animated.View
        style={[
          styles.pulseRing,
          styles.pulseRing2,
          {
            opacity: ring2Opacity,
            transform: [{ scale: ring2Scale }],
          },
        ]}
      />

      {/* Main pin button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={styles.pinTouchable}
      >
        <LinearGradient
          colors={['#FF3366', '#FF6B35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pinCircle}
        >
          <Ionicons name="location" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Pin tail */}
      <View style={styles.pinTail} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    alignItems: 'center',
  },
  // ─── Label pill ─────────────────────────────────
  labelPill: {
    backgroundColor: 'rgba(20,20,35,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.2)',
    maxWidth: 200,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelArrow: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(20,20,35,0.92)',
  },
  // ─── Pulse rings ────────────────────────────────
  pulseRing: {
    position: 'absolute',
    bottom: 10,
    width: PIN_SIZE + 20,
    height: PIN_SIZE + 20,
    borderRadius: (PIN_SIZE + 20) / 2,
    borderWidth: 2,
    borderColor: '#FF3366',
  },
  pulseRing2: {
    borderColor: '#FF6B35',
    borderWidth: 1.5,
  },
  // ─── Main pin circle ────────────────────────────
  pinTouchable: {
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  pinCircle: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  // ─── Pin tail ───────────────────────────────────
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF6B35',
    marginTop: -2,
  },
});

export default RatePromptFAB;
