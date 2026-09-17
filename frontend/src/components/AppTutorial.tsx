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
    id:       'energy',
    emoji:    '◉',
    label:    'ENERGY',
    headline: 'The city, by how\nalive it is.',
    body:     'Not how busy a place is. How alive it is. A packed room can be dead and twenty people can be electric, and only someone standing inside can tell you which.',
    gradient: ['#FF3366', '#FF6B35'],
    accent:   '#FF3366',
    step:     '01 / 04',
  },
  {
    id:       'map',
    emoji:    '▲',
    label:    'THE MAP',
    headline: 'Open it. See where\nthe night is.',
    body:     'Every gathering glows by how alive it is right now. White hot for a room that is going, grey for one that is not. Readings expire in minutes, because the feeling does.',
    gradient: ['#FF9933', '#FFD700'],
    accent:   '#FF9933',
    step:     '02 / 04',
  },
  {
    id:       'reading',
    emoji:    '●',
    label:    'ADD A READING',
    headline: 'Three seconds,\nfrom inside.',
    body:     'Energy, how full, the door. That is the whole thing. Your phone confirms you are actually there, which is the only reason anyone can trust what you say.',
    gradient: ['#3399FF', '#9933FF'],
    accent:   '#3399FF',
    step:     '03 / 04',
  },
  {
    id:       'clout',
    emoji:    '◆',
    label:    'BUILD YOUR RECORD',
    headline: 'Being right is\nthe whole game.',
    body:     'Every reading you give builds your clout, and clout decides how much your next reading counts. It cannot be bought. Nobody can pay to look alive here.',
    gradient: ['#00E676', '#00D4FF'],
    accent:   '#00E676',
    step:     '04 / 04',
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
