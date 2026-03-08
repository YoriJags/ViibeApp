/**
 * VariableRewardOverlay — VIIBE variable reward system.
 *
 * Triggers from the SAME bolt tap action. No new tapping UI.
 * Three tiers of rare events that make the bolt feel electric:
 *
 *   Critical Hit  (1:10)  — lightning flash + "+CRITICAL HIT" burst
 *   Surge Tap     (1:50)  — expanding rings + "+SURGE" glow
 *   Decisive Voice (1:200) — golden crown + "+VOICE HEARD" + clout bonus
 *
 * Usage: wrap around or position above bolt button.
 * Call `trigger(type)` to fire an animation.
 */
import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RewardType = 'critical_hit' | 'surge_tap' | 'decisive_voice';

export interface VariableRewardRef {
  trigger: (type: RewardType) => void;
}

// ─── Reward config ────────────────────────────────────────────────────────────

const REWARD_CONFIG: Record<RewardType, {
  icon: string; label: string; sub: string;
  color: string; bgColor: string;
  cloutBonus: number;
}> = {
  critical_hit: {
    icon: 'flash',
    label: '+CRITICAL HIT',
    sub: 'Your bolt hit harder',
    color: '#FF3366',
    bgColor: 'rgba(255,51,102,0.15)',
    cloutBonus: 0,
  },
  surge_tap: {
    icon: 'pulse',
    label: '+SURGE',
    sub: 'Rare pulse moment',
    color: '#FF9933',
    bgColor: 'rgba(255,153,51,0.12)',
    cloutBonus: 5,
  },
  decisive_voice: {
    icon: 'star',
    label: '+VOICE HEARD',
    sub: '+10 clout · Your rating counts more',
    color: '#FFD700',
    bgColor: 'rgba(255,215,0,0.12)',
    cloutBonus: 10,
  },
};

// ─── Ring pulse (for surge_tap) ───────────────────────────────────────────────

function RingPulse({ color, delay = 0 }: { color: string; delay?: number }) {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(scale, { toValue: 2.5, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ]),
      { iterations: 3 }
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        ringStyles.ring,
        { borderColor: color, transform: [{ scale }], opacity },
      ]}
    />
  );
}

const ringStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2,
    alignSelf: 'center',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

const VariableRewardOverlay = forwardRef<VariableRewardRef, object>((_, ref) => {
  const [activeReward, setActiveReward] = useState<RewardType | null>(null);
  const floatAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.6)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    trigger: (type: RewardType) => {
      setActiveReward(type);
      floatAnim.setValue(0);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.6);
      glowAnim.setValue(0);

      Animated.parallel([
        // Pop in
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
        // Float up
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(1200),
          Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(floatAnim, { toValue: -80, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        // Glow pulse
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(800),
          Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start(() => setActiveReward(null));
    },
  }));

  if (!activeReward) return null;

  const cfg = REWARD_CONFIG[activeReward];

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Ring pulses for surge */}
      {activeReward === 'surge_tap' && (
        <>
          <RingPulse color={cfg.color} delay={0} />
          <RingPulse color={cfg.color} delay={280} />
          <RingPulse color={cfg.color} delay={560} />
        </>
      )}

      {/* Floating label */}
      <Animated.View
        style={[
          styles.labelCard,
          { backgroundColor: cfg.bgColor, borderColor: cfg.color + '50' },
          {
            transform: [{ translateY: floatAnim }, { scale: scaleAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
        <View style={{ gap: 1 }}>
          <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
          {cfg.sub ? <Text style={styles.sub}>{cfg.sub}</Text> : null}
        </View>
        {activeReward === 'decisive_voice' && (
          <Animated.View style={[styles.crown, { opacity: glowAnim }]}>
            <Text style={styles.crownEmoji}>👑</Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
});

VariableRewardOverlay.displayName = 'VariableRewardOverlay';
export default VariableRewardOverlay;

// ─── Hook to roll variable reward ────────────────────────────────────────────

export function rollVariableReward(): RewardType | null {
  const roll = Math.random();
  if (roll < 1 / 200) return 'decisive_voice';  // 0.5% — Decisive Voice
  if (roll < 1 / 50)  return 'surge_tap';       // 2%   — Surge Tap
  if (roll < 1 / 10)  return 'critical_hit';    // 10%  — Critical Hit
  return null;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'none' as any,
  },
  labelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
    shadowColor: '#FF3366', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  label: {
    fontSize: 13, fontWeight: '900', letterSpacing: 0.5,
  },
  sub: {
    fontSize: 10, color: '#888', fontWeight: '500',
  },
  crown: {
    position: 'absolute', top: -16, right: -4,
  },
  crownEmoji: { fontSize: 18 },
});
