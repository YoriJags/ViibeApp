/**
 * ModeChoice — the first screen after the splash, every launch.
 *
 * One question: see Lagos as it really is right now, or take the demo tour of
 * the finished app. Everything that used to greet people on open (recaps,
 * streak bonus, the tour) lives inside the demo; live opens straight onto the
 * real app with nothing on top of it.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { publicTheme } from '../theme/floors';

const { colors } = publicTheme;

interface Props {
  onLive: () => void;
  onDemo: () => void;
}

export default function ModeChoice({ onLive, onDemo }: Props) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const pick = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    fn();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 28 }]}>
      <Animated.View style={[styles.inner, { opacity: fade }]}>
        <View style={styles.brand}>
          <Text style={styles.wordmark}>VIIBE</Text>
          <Text style={styles.tagline}>How do you want to see Lagos?</Text>
        </View>

        <View style={styles.choices}>
          <TouchableOpacity activeOpacity={0.85} onPress={pick(onLive)} accessibilityRole="button">
            <LinearGradient
              colors={['#FF3366', '#FF6B35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardPrimary}
            >
              <View style={styles.cardHead}>
                <View style={styles.liveDot} />
                <Text style={styles.cardTitle}>See Lagos live</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" style={styles.arrow} />
              </View>
              <Text style={styles.cardBody}>
                Real readings from people inside venues right now. A quiet night looks quiet.
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={pick(onDemo)} accessibilityRole="button">
            <View style={styles.cardSecondary}>
              <View style={styles.cardHead}>
                <Ionicons name="play-circle" size={20} color="#F5C542" />
                <Text style={[styles.cardTitle, styles.cardTitleDemo]}>Take the demo tour</Text>
                <Ionicons name="arrow-forward" size={20} color="#F5C542" style={styles.arrow} />
              </View>
              <Text style={styles.cardBodyMuted}>
                A full night in Lagos the way VIIBE works when the whole city is reading. Sample data.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>You can switch any time from your Profile.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
    paddingHorizontal: 24,
  },
  inner: { flex: 1, justifyContent: 'space-between' },
  brand: { alignItems: 'center', marginTop: 24 },
  wordmark: {
    color: '#FFF',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 6,
    textShadowColor: 'rgba(255,51,102,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  tagline: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 17,
    marginTop: 14,
    fontWeight: '500',
  },
  choices: { gap: 14 },
  cardPrimary: { borderRadius: 20, padding: 22 },
  cardSecondary: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(245,197,66,0.35)',
    backgroundColor: 'rgba(245,197,66,0.06)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  cardTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', flex: 1 },
  cardTitleDemo: { color: '#F5C542' },
  arrow: { marginLeft: 'auto' },
  cardBody: { color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 21 },
  cardBodyMuted: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 21 },
  footnote: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
});
