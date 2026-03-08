/**
 * SceneMoodSelector — Pre-session intent setter.
 *
 * Appears once per session (time-gated: evening hours) before scouting.
 * Sets the user's "scene mood" which weights their bolt taps and personalizes
 * the Insider feed. NOT a second rating — purely context / intent.
 *
 * Unified with the bolt system: scene mood × tap velocity = individual resonance signal.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Animated, Dimensions, PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.62;
const DISMISS_THRESHOLD = 100;

// ─── Mood config ─────────────────────────────────────────────────────────────

export type SceneMood = 'easy_flow' | 'high_energy' | 'mixed_scene' | 'low_key';

interface MoodOption {
  key: SceneMood;
  emoji: string;
  label: string;
  sub: string;
  color: string;
  gradient: [string, string];
}

const MOODS: MoodOption[] = [
  {
    key: 'high_energy' as SceneMood,
    emoji: '⚡',
    label: 'High Energy',
    sub: 'Full send — I want electric',
    color: '#FF3366',
    gradient: ['#FF3366', '#FF6633'],
  },
  {
    key: 'easy_flow',
    emoji: '🌊',
    label: 'Easy Flow',
    sub: 'Vibing wherever the night takes me',
    color: '#3399FF',
    gradient: ['#3399FF', '#00D4FF'],
  },
  {
    key: 'mixed_scene',
    emoji: '🎭',
    label: 'Mixed Scene',
    sub: 'Open to anything — show me options',
    color: '#9933FF',
    gradient: ['#9933FF', '#CC44FF'],
  },
  {
    key: 'low_key',
    emoji: '🌙',
    label: 'Low Key',
    sub: 'Relaxed, intimate, no loud crowds',
    color: '#00E676',
    gradient: ['#00E676', '#00D4FF'],
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SceneMoodSelectorProps {
  visible: boolean;
  onSelect: (mood: SceneMood) => void;
  onSkip: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SceneMoodSelector({ visible, onSelect, onSkip }: SceneMoodSelectorProps) {
  const translateY     = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScales     = useRef(MOODS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  const dismiss = (callback: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 240, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(callback);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dx) < Math.abs(g.dy),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) dismiss(onSkip);
        else Animated.spring(translateY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
      },
    })
  ).current;

  const handleSelect = (mood: SceneMood, idx: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(cardScales[idx], { toValue: 1.06, duration: 100, useNativeDriver: true }),
      Animated.spring(cardScales[idx], { toValue: 1, tension: 250, friction: 10, useNativeDriver: true }),
    ]).start();
    dismiss(() => onSelect(mood));
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => dismiss(onSkip)}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={styles.backdropTouchable} onPress={() => dismiss(onSkip)} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <BlurView intensity={50} tint="dark" style={styles.blurFill}>
          <LinearGradient colors={['rgba(16,10,26,0.97)', 'rgba(8,6,16,0.99)']} style={styles.gradient}>
            {/* Handle */}
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="moon" size={18} color="#9933FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Set Your Scene Mood</Text>
                <Text style={styles.subtitle}>This shapes how we read your bolts tonight</Text>
              </View>
            </View>

            {/* Mood grid */}
            <View style={styles.grid}>
              {MOODS.map((mood, i) => (
                <Animated.View key={mood.key} style={[styles.cardWrap, { transform: [{ scale: cardScales[i] }] }]}>
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => handleSelect(mood.key, i)}
                    activeOpacity={0.75}
                  >
                    <LinearGradient
                      colors={[mood.color + '18', mood.color + '08']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.cardBorder, { borderColor: mood.color + '35' }]} />
                    <Text style={styles.cardEmoji}>{mood.emoji}</Text>
                    <Text style={[styles.cardLabel, { color: mood.color }]}>{mood.label}</Text>
                    <Text style={styles.cardSub}>{mood.sub}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            {/* Skip */}
            <TouchableOpacity style={styles.skipBtn} onPress={() => dismiss(onSkip)} activeOpacity={0.6}>
              <Text style={styles.skipText}>Skip for tonight</Text>
            </TouchableOpacity>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  backdropTouchable: { flex: 1 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(153,51,255,0.2)',
  },
  blurFill: { flex: 1 },
  gradient: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  handleRow: { alignItems: 'center', paddingBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 20,
  },
  headerIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(153,51,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(153,51,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  cardWrap: { width: '48%', borderRadius: 18, overflow: 'hidden' },
  card: {
    borderRadius: 18, padding: 16, alignItems: 'center', gap: 6,
    overflow: 'hidden', minHeight: 110,
    justifyContent: 'center',
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1,
  },
  cardEmoji: { fontSize: 28, lineHeight: 34 },
  cardLabel: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  cardSub: { fontSize: 10, color: '#666', textAlign: 'center', lineHeight: 14 },
  skipBtn: {
    alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24,
    marginTop: 4,
  },
  skipText: { fontSize: 13, color: '#3A3A5A', fontWeight: '600' },
});
