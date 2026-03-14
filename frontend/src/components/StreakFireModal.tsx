/**
 * StreakFireModal — Full-screen streak milestone celebration.
 * Triggers at 3, 7, 14, 30-night milestones.
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  streak: number;
  cloutBonus: number;
  onClaim: () => void;
  onDismiss: () => void;
}

function getMilestoneLabel(streak: number): { label: string; color: string } {
  if (streak >= 30) return { label: 'LEGENDARY',    color: '#FFD700' };
  if (streak >= 14) return { label: 'UNSTOPPABLE',  color: '#9933FF' };
  if (streak >=  7) return { label: 'FULLY LIT',    color: '#FF3366' };
  return               { label: 'WARMING UP',    color: '#FF8C00' };
}

// 5 flame positions arranged in a circle (angle in degrees)
const FLAME_ANGLES = [0, 72, 144, 216, 288];
const FLAME_RADIUS = 100;

export default function StreakFireModal({ visible, streak, cloutBonus, onClaim, onDismiss }: Props) {
  const scaleAnim   = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  const milestone = getMilestoneLabel(streak);

  useEffect(() => {
    if (!visible) return;

    // Entrance: spring scale + fade in
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Flame ring rotation — loop 0→1 over 8000ms
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Streak number pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 750, useNativeDriver: true }),
      ])
    ).start();

    // Haptics: success + echo
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const echoTimer = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 400);

    return () => {
      clearTimeout(echoTimer);
      // Stop loops before resetting — prevents them running after unmount
      rotateAnim.stopAnimation();
      pulseAnim.stopAnimation();
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      rotateAnim.setValue(0);
      pulseAnim.setValue(1);
    };
  }, [visible]);

  const rotateDeg = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <LinearGradient
          colors={['#0A0008', '#07070F', '#0A000A']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Flame ring */}
          <View style={styles.flameRingContainer}>
            <Animated.View
              style={[styles.flameRing, { transform: [{ rotate: rotateDeg }] }]}
            >
              {FLAME_ANGLES.map((angleDeg, i) => {
                const rad = (angleDeg * Math.PI) / 180;
                const x = Math.cos(rad) * FLAME_RADIUS;
                const y = Math.sin(rad) * FLAME_RADIUS;
                return (
                  <View
                    key={i}
                    style={[
                      styles.flameEmoji,
                      {
                        transform: [
                          { translateX: x },
                          { translateY: y },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.flameText}>🔥</Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* Center: streak count */}
            <Animated.View style={[styles.streakCenter, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.streakNumber}>{streak}</Text>
            </Animated.View>
          </View>

          {/* Labels */}
          <Text style={styles.nightStreakLabel}>NIGHT STREAK</Text>

          <View style={[styles.milestoneBadge, { borderColor: milestone.color + '40' }]}>
            <Text style={[styles.milestoneLabel, { color: milestone.color }]}>
              {milestone.label}
            </Text>
          </View>

          {/* Clout bonus */}
          <View style={styles.cloutBox}>
            <Text style={styles.cloutBonusText}>+{cloutBonus} CLOUT BONUS</Text>
          </View>

          {/* Claim button */}
          <TouchableOpacity style={styles.claimBtn} onPress={onClaim} activeOpacity={0.85}>
            <LinearGradient
              colors={['#FF3366', '#FF8C00']}
              style={styles.claimBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.claimBtnText}>CLAIM BONUS</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDismiss} style={styles.dismissLink} activeOpacity={0.6}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: W - 48,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 16,
  },

  // Flame ring
  flameRingContainer: {
    width: FLAME_RADIUS * 2 + 60,
    height: FLAME_RADIUS * 2 + 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  flameRing: {
    position: 'absolute',
    width: FLAME_RADIUS * 2 + 60,
    height: FLAME_RADIUS * 2 + 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameEmoji: {
    position: 'absolute',
  },
  flameText: {
    fontSize: 28,
  },

  // Streak center
  streakCenter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0F0010',
    borderWidth: 2,
    borderColor: '#FF336640',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNumber: {
    fontSize: 88,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 96,
  },

  // Labels
  nightStreakLabel: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#FF3366',
    textAlign: 'center',
  },
  milestoneBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#0C0C18',
  },
  milestoneLabel: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // Clout bonus
  cloutBox: {
    borderWidth: 1,
    borderColor: '#FFD70040',
    borderRadius: 12,
    backgroundColor: '#FFD70008',
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cloutBonusText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1.5,
  },

  // Claim button
  claimBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  claimBtnGrad: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  claimBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },

  // Dismiss
  dismissLink: {
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 13,
    color: '#2A2A4A',
    fontWeight: '600',
  },
});
