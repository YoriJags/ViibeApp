/**
 * PulseButton — Quick 1-tap scout signal.
 *
 * Lower friction than a full rating. Scout drops a PULSE to signal
 * "I'm here and it's live." Earns 3 clout. Feeds the city's heartbeat.
 * 15-minute cooldown per venue.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface PulseButtonProps {
  onPress: () => Promise<{ success: boolean; clout_earned?: number }>;
  disabled?: boolean;
  pulsedAt?: number | null;   // timestamp of last pulse (ms)
  style?: object;
}

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

const PulseButton: React.FC<PulseButtonProps> = ({
  onPress,
  disabled = false,
  pulsedAt = null,
  style,
}) => {
  const [loading, setLoading]     = useState(false);
  const [justPulsed, setJustPulsed] = useState(false);
  const ringAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0.4)).current;

  const isOnCooldown = pulsedAt
    ? Date.now() - pulsedAt < COOLDOWN_MS
    : false;

  const isDisabled = disabled || isOnCooldown || loading;

  // ─── Idle glow pulse ─────────────────────────────────────────
  useEffect(() => {
    if (isDisabled) return;
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, [isDisabled]);

  // ─── Tap animation ───────────────────────────────────────────
  const triggerTapAnim = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80,  useNativeDriver: true }),
      Animated.spring(scaleAnim,  { toValue: 1,    tension: 300, friction: 8, useNativeDriver: true }),
    ]).start();

    // Ring burst
    ringAnim.setValue(0);
    Animated.timing(ringAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  };

  const handlePress = async () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    triggerTapAnim();
    setLoading(true);
    const result = await onPress();
    setLoading(false);
    if (result.success) {
      setJustPulsed(true);
      setTimeout(() => setJustPulsed(false), 3000);
    }
  };

  return (
    <Animated.View style={[styles.wrapper, style, { transform: [{ scale: scaleAnim }] }]}>
      {/* Ring burst on tap */}
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.8, 0.4, 0] }),
            transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
          },
        ]}
      />

      <TouchableOpacity
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={styles.touch}
      >
        {isOnCooldown ? (
          <View style={styles.cooldownInner}>
            <Text style={styles.pulsedEmoji}>⚡</Text>
            <Text style={styles.pulsedLabel}>PULSED</Text>
          </View>
        ) : (
          <LinearGradient
            colors={isDisabled ? ['#1A1A2E', '#111118'] : ['#FF3366', '#9933FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientInner}
          >
            <Animated.Text style={[styles.icon, { opacity: glowAnim }]}>
              {justPulsed ? '✦' : '◉'}
            </Animated.Text>
            <View>
              <Text style={[styles.label, isDisabled && styles.labelDisabled]}>
                PULSE
              </Text>
              <Text style={[styles.clout, isDisabled && styles.cloutDisabled]}>
                +3 clout
              </Text>
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'visible',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    inset: -4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF3366',
    zIndex: -1,
  },
  touch: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
    borderRadius: 16,
  },
  cooldownInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 6,
    backgroundColor: 'rgba(255,51,102,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.2)',
  },
  icon: {
    fontSize: 18,
    color: '#FFF',
  },
  label: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
    lineHeight: 16,
  },
  labelDisabled: { color: '#555' },
  clout: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  cloutDisabled: { color: '#444' },
  pulsedEmoji: { fontSize: 14, color: '#FF3366' },
  pulsedLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 1.5,
  },
});

export default PulseButton;
