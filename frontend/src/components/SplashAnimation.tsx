/**
 * SplashAnimation - Cinematic branded intro for app startup
 *
 * Animation sequence:
 * 1. Letters "V I B E" stagger in (scale + opacity), 0-800ms
 * 2. Tagline fades up, neon glow pulses begin, 800-1400ms
 * 3. Pulsing neon ring loop while app loads
 * 4. On ready: entire screen scales up + fades out (500ms)
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SplashAnimationProps {
  onAnimationComplete: () => void;
  isReady: boolean;
}

const LETTERS = ['V', 'I', 'B', 'E'];
const STAGGER_DELAY = 150;

export default function SplashAnimation({
  onAnimationComplete,
  isReady,
}: SplashAnimationProps) {
  // Letter animations
  const letterAnims = useRef(
    LETTERS.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.3),
      translateY: new Animated.Value(30),
    })),
  ).current;

  // Tagline
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(15)).current;

  // Pulse ring
  const pulseScale = useRef(new Animated.Value(0.8)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  // Loading dots
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  // Exit animation
  const exitScale = useRef(new Animated.Value(1)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  // Entrance sequence
  useEffect(() => {
    // 1. Stagger letters in
    const letterAnimations = letterAnims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 400,
          delay: i * STAGGER_DELAY,
          useNativeDriver: true,
        }),
        Animated.spring(anim.scale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          delay: i * STAGGER_DELAY,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 400,
          delay: i * STAGGER_DELAY,
          useNativeDriver: true,
        }),
      ]),
    );

    // 2. After letters, show tagline + start pulse
    const afterLetters = LETTERS.length * STAGGER_DELAY + 300;

    const taglineAnimation = Animated.parallel([
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        delay: afterLetters,
        useNativeDriver: true,
      }),
      Animated.timing(taglineTranslateY, {
        toValue: 0,
        duration: 500,
        delay: afterLetters,
        useNativeDriver: true,
      }),
    ]);

    // 3. Pulse ring
    const pulseAnimation = Animated.sequence([
      Animated.delay(afterLetters - 100),
      Animated.parallel([
        Animated.timing(pulseOpacity, {
          toValue: 0.6,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]);

    Animated.parallel([
      ...letterAnimations,
      taglineAnimation,
      pulseAnimation,
    ]).start(() => {
      // Start looping pulse
      startPulseLoop();
      startDotsLoop();
    });
  }, []);

  // Looping pulse glow
  const startPulseLoop = () => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.15,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.2,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.6,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();
  };

  // Looping loading dots
  const startDotsLoop = () => {
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );

    animateDot(dot1, 0).start();
    animateDot(dot2, 200).start();
    animateDot(dot3, 400).start();
  };

  // Exit animation when ready
  useEffect(() => {
    if (!isReady) return;

    // Small delay so the user sees the completed splash briefly
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitScale, {
          toValue: 1.08,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationComplete();
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [isReady]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: exitOpacity,
          transform: [{ scale: exitScale }],
        },
      ]}
    >
      {/* Background gradient */}
      <LinearGradient
        colors={['#0A0A0F', '#12101F', '#0A0A0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Pulsing neon ring behind the letters */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      {/* VIBE letters */}
      <View style={styles.lettersRow}>
        {LETTERS.map((letter, i) => (
          <Animated.Text
            key={letter + i}
            style={[
              styles.letter,
              {
                opacity: letterAnims[i].opacity,
                transform: [
                  { scale: letterAnims[i].scale },
                  { translateY: letterAnims[i].translateY },
                ],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>

      {/* Tagline */}
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslateY }],
          },
        ]}
      >
        Feel the city's pulse
      </Animated.Text>

      {/* Loading dots */}
      <View style={styles.dotsContainer}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.loadingDot, { opacity: dot }]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
    zIndex: 100,
  },
  pulseRing: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: SCREEN_WIDTH * 0.3,
    borderWidth: 2,
    borderColor: '#FF3366',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 10,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  letter: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#B0B0B0',
    letterSpacing: 2,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3366',
  },
});
