/**
 * AppTutorial — Instagram-story-style how-to guide.
 *
 * Shown once after onboarding completes (new users) or on first launch
 * for existing users who haven't seen it yet.
 *
 * 6 slides: Reactor · Rating · Skins · Torch · Scene Frequency · Ranks
 *
 * UX pattern:
 *   - Progress bars at top fill as user advances
 *   - Tap right half of screen → next slide
 *   - Tap left half → previous slide
 *   - Explicit Next / Skip buttons also provided
 *   - Slides out with fade when complete
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Animated,
  FlatList,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');

// ─── Slide definitions ───────────────────────────────────────────────────────

interface Slide {
  id:       string;
  emoji:    string;
  label:    string;
  headline: string;
  body:     string;
  gradient: [string, string];
  accent:   string;
  step:     string; // e.g. "FEATURE 1 OF 6"
}

const SLIDES: Slide[] = [
  {
    id:       'reactor',
    emoji:    '⚡',
    label:    'REACTOR',
    headline: 'Tap to charge the room.',
    body:     'Every tap you make lifts the venue\'s live energy score. Show up first, tap hardest, lead the charge — and earn scout rank in the process.',
    gradient: ['#FF3366', '#FF6B35'],
    accent:   '#FF3366',
    step:     '01 / 06',
  },
  {
    id:       'rating',
    emoji:    '⭐',
    label:    'RATE THE VIBE',
    headline: 'Your 10-second\ncity report.',
    body:     'Three questions: energy, crowd, door wait. That\'s it. Your rating updates every scout in the city the moment you submit.',
    gradient: ['#FF9933', '#FFD700'],
    accent:   '#FF9933',
    step:     '02 / 06',
  },
  {
    id:       'skins',
    emoji:    '✦',
    label:    'REACTOR SKINS',
    headline: '8 ways to see\nthe scene.',
    body:     'Switch your energy display — AURA, TERRAIN, MATRIX, RADAR and more. Every skin visualises the crowd\'s energy differently. Find your vibe.',
    gradient: ['#CC44FF', '#9933FF'],
    accent:   '#CC44FF',
    step:     '03 / 06',
  },
  {
    id:       'torch',
    emoji:    '🔦',
    label:    'TORCH IGNITE',
    headline: 'Sync your light\nwith the crowd.',
    body:     'Hold IGNITE together with other scouts to fire a synchronized flashlight moment across the whole venue. The artist says go — you go.',
    gradient: ['#FFD700', '#FF9933'],
    accent:   '#FFD700',
    step:     '04 / 06',
  },
  {
    id:       'oscillator',
    emoji:    '📡',
    label:    'SCENE FREQUENCY',
    headline: 'The city\'s pulse,\nvisualised.',
    body:     'VIBE+ exclusive. Real BPM, real crowd energy — rendered as a live waveform. Know exactly what the room feels like before you ever walk in.',
    gradient: ['#3399FF', '#9933FF'],
    accent:   '#3399FF',
    step:     '05 / 06',
  },
  {
    id:       'clout',
    emoji:    '🏆',
    label:    'EARN YOUR RANK',
    headline: 'Your insight\nbuilds your legend.',
    body:     'Every tap, every rating, every night out adds to your Clout. Rise from Newcomer through Scout ranks to City Elite — and shape where the city goes.',
    gradient: ['#00E676', '#00D4FF'],
    accent:   '#00E676',
    step:     '06 / 06',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  visible:    boolean;
  onComplete: () => void;
}

export default function AppTutorial({ visible, onComplete }: Props) {
  const [index, setIndex]   = useState(0);
  const flatListRef         = useRef<FlatList>(null);
  const fadeAnim            = useRef(new Animated.Value(1)).current;

  const goTo = useCallback((next: number) => {
    if (next >= SLIDES.length) {
      // Fade out then complete
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setIndex(0);
        fadeAnim.setValue(1);
        onComplete();
      });
      return;
    }
    if (next < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }, [onComplete, fadeAnim]);

  const handleScreenTap = useCallback((evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < W * 0.3) {
      goTo(index - 1);
    } else {
      goTo(index + 1);
    }
  }, [index, goTo]);

  const slide = SLIDES[index];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
    >
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        {/* Gradient background shifts per slide */}
        <LinearGradient
          colors={[slide.gradient[0] + '22', '#05050A']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Progress bars ────────────────────────────────────────── */}
        <View style={styles.progressRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: slide.accent,
                    flex: i < index ? 1 : i === index ? 1 : 0,
                    opacity: i <= index ? 1 : 0.22,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* ── Skip button ───────────────────────────────────────────── */}
        <TouchableOpacity style={styles.skipBtn} onPress={onComplete} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* ── Tappable content area ────────────────────────────────── */}
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={styles.contentArea}>

            {/* Visual */}
            <View style={styles.visualWrap}>
              <LinearGradient
                colors={[slide.gradient[0] + '40', slide.gradient[1] + '20']}
                style={styles.emojiCircle}
              >
                <Text style={styles.emoji}>{slide.emoji}</Text>
              </LinearGradient>
              {/* Outer glow ring */}
              <View style={[styles.glowRing, { borderColor: slide.accent + '30' }]} />
            </View>

            {/* Step label */}
            <Text style={[styles.stepLabel, { color: slide.accent }]}>{slide.step}  {slide.label}</Text>

            {/* Headline */}
            <Text style={styles.headline}>{slide.headline}</Text>

            {/* Body */}
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        </TouchableWithoutFeedback>

        {/* ── Bottom nav ───────────────────────────────────────────── */}
        <View style={styles.bottomRow}>
          {/* Tap hint */}
          <Text style={styles.tapHint}>tap anywhere to continue</Text>

          {/* Next / Get Started */}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: slide.accent }]}
            onPress={() => goTo(index + 1)}
            activeOpacity={0.85}
          >
            <Text style={styles.nextText}>
              {index === SLIDES.length - 1 ? "Let's Go" : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05050A',
  },

  // Progress
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 4,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Skip
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 10,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },

  // Content
  contentArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },

  // Visual
  visualWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  emojiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 64,
  },

  // Text
  stepLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  headline: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Bottom
  bottomRow: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
  },
  tapHint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.18)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  nextBtn: {
    paddingHorizontal: 48,
    paddingVertical: 15,
    borderRadius: 30,
    minWidth: 180,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
