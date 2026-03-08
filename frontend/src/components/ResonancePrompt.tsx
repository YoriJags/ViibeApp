/**
 * ResonancePrompt — Post-venue quality annotation.
 *
 * This is NOT a second rating UI. It's a quality layer on top of the
 * bolt taps already made. Appears once after the user has been at a
 * venue for 30+ min (or after explicitly leaving).
 *
 * 5-bolt scale: 1 = did not land | 5 = pure resonance
 * Auto-dismisses after 4s if ignored. Single tap, no confirm needed.
 * Connects individual quality signal to collective bolt count.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTO_DISMISS_MS = 4000;

// ─── Bolt icons ───────────────────────────────────────────────────────────────

const RESONANCE_LABELS: Record<number, { label: string; color: string; sub: string }> = {
  1: { label: 'Didn\'t land',  color: '#3399FF', sub: 'Not your scene tonight'      },
  2: { label: 'Low vibe',     color: '#9933FF', sub: 'Had its moments'              },
  3: { label: 'Decent',       color: '#FF9933', sub: 'Solid but not memorable'      },
  4: { label: 'Felt it',      color: '#FF6633', sub: 'Good energy, good time'       },
  5: { label: 'Pure resonance', color: '#FF3366', sub: 'This one hits different ⚡' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ResonancePromptProps {
  visible: boolean;
  venueName: string;
  boltCount: number;        // how many bolts user tapped at this venue (context)
  onSelect: (score: number) => void;
  onDismiss: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResonancePrompt({
  visible, venueName, boltCount, onSelect, onDismiss,
}: ResonancePromptProps) {
  const [hovered, setHovered] = useState(0);
  const slideAnim   = useRef(new Animated.Value(120)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setHovered(0);
      progressAnim.setValue(1);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      // Progress bar drain
      Animated.timing(progressAnim, {
        toValue: 0, duration: AUTO_DISMISS_MS, useNativeDriver: false,
      }).start();
      // Auto-dismiss
      dismissTimer.current = setTimeout(() => {
        hide(onDismiss);
      }, AUTO_DISMISS_MS);
    } else {
      slideAnim.setValue(120);
      fadeAnim.setValue(0);
    }
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, [visible]);

  const hide = (callback: () => void) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 120, duration: 220, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(callback);
  };

  const handleSelect = (score: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    hide(() => onSelect(score));
  };

  if (!visible) return null;

  const activeLabel = hovered > 0 ? RESONANCE_LABELS[hovered] : null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <BlurView intensity={60} tint="dark" style={styles.blur}>
        <View style={styles.inner}>
          {/* Progress bar (auto-dismiss timer) */}
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1], outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="flash" size={14} color="#FF3366" />
              <Text style={styles.headerLabel}>HOW DID IT RESONATE?</Text>
            </View>
            <TouchableOpacity onPress={() => hide(onDismiss)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Venue name + bolt context */}
          <Text style={styles.venueName} numberOfLines={1}>{venueName}</Text>
          <Text style={styles.boltContext}>
            You dropped {boltCount} bolt{boltCount !== 1 ? 's' : ''} here
          </Text>

          {/* 5-bolt scale */}
          <View style={styles.boltRow}>
            {[1, 2, 3, 4, 5].map((score) => {
              const isActive = hovered >= score;
              const color = RESONANCE_LABELS[score].color;
              return (
                <TouchableOpacity
                  key={score}
                  style={styles.boltBtn}
                  onPress={() => handleSelect(score)}
                  onPressIn={() => setHovered(score)}
                  onPressOut={() => setHovered(0)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isActive ? 'flash' : 'flash-outline'}
                    size={28}
                    color={isActive ? color : '#2A2A3E'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dynamic label */}
          {activeLabel ? (
            <View style={styles.labelRow}>
              <Text style={[styles.resonanceLabel, { color: activeLabel.color }]}>
                {activeLabel.label}
              </Text>
              <Text style={styles.resonanceSub}>{activeLabel.sub}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>Tap a bolt — dismiss in {Math.round(AUTO_DISMISS_MS / 1000)}s</Text>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.25)',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  blur: { borderRadius: 22 },
  inner: {
    backgroundColor: 'rgba(10,8,20,0.92)',
    padding: 16,
    gap: 8,
  },
  progressBar: {
    position: 'absolute', top: 0, left: 0,
    height: 2, backgroundColor: '#FF3366',
    borderTopLeftRadius: 22,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 9, fontWeight: '900', color: '#FF3366', letterSpacing: 2 },
  venueName: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  boltContext: { fontSize: 11, color: '#444', fontWeight: '500' },
  boltRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 8,
  },
  boltBtn: {
    padding: 6,
  },
  labelRow: { alignItems: 'center', gap: 2, minHeight: 32 },
  resonanceLabel: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  resonanceSub: { fontSize: 11, color: '#666' },
  hint: { fontSize: 11, color: '#2A2A3E', textAlign: 'center', minHeight: 32, lineHeight: 32 },
});
