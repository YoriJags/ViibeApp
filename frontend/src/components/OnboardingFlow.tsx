/**
 * Onboarding: three slides and a choice (design spec, Nov 2026).
 *   1. The punchline.  2. Read by the people inside.  3. Nothing rather than a lie.
 *   Then: Sign in, or Look around first (demo, clearly marked).
 * Replaces OnboardingFlow + AppTutorial back to back, the role picker and the
 * emoji art. One primary button, progress dots, Skip top-right.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Button } from './ui';
import { color, ironbowStops, radius, space, type } from '../theme/tokens';
import { useVibeStore } from '../store/vibeStore';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const SLIDES = [
  { title: 'Google Maps tells you how to get there.', accent: 'VIIBE tells you if it\'s worth going.', body: 'Concerts, festivals and raves in Lagos, read live.' },
  { title: 'Read by the people inside.', body: 'Someone in the room taps how alive it is, how full, and how the door is moving. It takes three seconds.' },
  { title: 'We would rather show nothing than lie.', body: 'Readings fade over a few hours, so a quiet place looks quiet. The map is always tonight.' },
];

function goWhenReady(path: string, attempt = 0) {
  try { router.push(path as any); } catch { if (attempt < 40) setTimeout(() => goWhenReady(path, attempt + 1), 250); }
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length;

  const finish = (mode: 'signin' | 'demo') => {
    const st = useVibeStore.getState() as any;
    st.completeAppTutorial?.();
    if (mode === 'demo' && !st.isDemoMode) st.toggleDemoMode?.();
    onComplete();
    if (mode === 'signin') setTimeout(() => goWhenReady('/(public)/profile'), 50);
  };

  return (
    <View style={s.root}>
      {/* The thermal glow, low on screen: the landing hero, reduced. */}
      <LinearGradient colors={['transparent', ironbowStops[2] + '55', ironbowStops[3] + '33']}
        start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[s.top, { paddingTop: insets.top + space.xs }]}>
        <Text style={s.mark}>VIIBE</Text>
        {!last && (
          <Pressable onPress={() => setI(SLIDES.length)} hitSlop={10} style={s.skip} accessibilityRole="button">
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={s.body}>
        {!last ? (
          <>
            <Text style={s.headline}>{SLIDES[i].title}</Text>
            {!!SLIDES[i].accent && <Text style={[s.headline, s.accent]}>{SLIDES[i].accent}</Text>}
            <Text style={s.copy}>{SLIDES[i].body}</Text>
          </>
        ) : (
          <>
            <Text style={s.headline}>See where it's alive tonight.</Text>
            <Text style={s.copy}>Sign in to take readings and follow places. Or look around first with sample data.</Text>
          </>
        )}
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + space.md }]}>
        {!last ? (
          <>
            <View style={s.dots} accessibilityLabel={`Step ${i + 1} of ${SLIDES.length}`}>
              {SLIDES.map((_, k) => <View key={k} style={[s.dot, k === i && s.dotOn]} />)}
            </View>
            <Button label="Next" onPress={() => setI(i + 1)} />
          </>
        ) : (
          <>
            <Button label="Sign in" onPress={() => finish('signin')} />
            <Button label="Look around first" variant="secondary" onPress={() => finish('demo')} style={{ marginTop: space.sm }} />
            <Text style={s.note}>Looking around uses sample data, marked Demo.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, minHeight: 56 },
  mark: { ...type.title, color: color.ink, letterSpacing: 2 },
  skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { ...type.labelStrong, color: color.inkSoft },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.md },
  headline: { ...type.headline, color: color.ink },
  accent: { color: ironbowStops[4], marginTop: space.xs },
  copy: { ...type.body, color: color.inkSoft, marginTop: space.md },
  bottom: { paddingHorizontal: space.md },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: space.lg },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.inkFaint },
  dotOn: { width: 18, backgroundColor: color.ink },
  note: { ...type.caption, color: color.inkSoft, textAlign: 'center', marginTop: space.sm },
});
