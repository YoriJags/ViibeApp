/**
 * PulseCheckCard — the one-tap refresh that stops the reading going stale.
 *
 * This is the ask a scout sees most often, so it is the one that must never
 * feel like a chore. A full vibe check is three questions, right once per
 * visit and far too much to repeat every fifteen minutes. Here they answer
 * one thing, and the app answers back.
 *
 * Three things carry the feel:
 *
 *   The clock is visible. A bar drains toward the moment the reading expires,
 *   so the ask explains itself: this is about to stop being true.
 *
 *   Each answer has its own haptic signature. Cooling falls, Same is a single
 *   flat confirm, Hotter rises and lands. The thumb learns the difference
 *   before the eye does, and the gesture starts to feel physical rather than
 *   administrative.
 *
 *   There is a payoff. The card does not just vanish; it flips to show the
 *   number moving because of them. That is the whole reward, and it is why
 *   two seconds feels like influence instead of data entry.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { getBoltCoordinates } from '../utils/boltLocation';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Matched to the venue screen this card sits on (glassy cards, gold labels,
// the app's orange accent) rather than the thermal palette used on the
// marketing site.
const UI = {
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  btnBg: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.5)',
  gold: '#C9A84C',
  accent: '#FF6B35',
  hot: '#FF3366',
  cool: '#60A5FA',
};

/** Readings die at 15 minutes; ask once we are close. */
export const PROMPT_AFTER_MINUTES = 10;
const READING_LIFESPAN_MINUTES = 15;

type Delta = 'same' | 'hotter' | 'cooling';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * A distinct shape per answer: falling for cooling, one flat beat for same,
 * rising and landing for hotter.
 */
async function haptic(delta: Delta) {
  try {
    if (delta === 'cooling') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await wait(90);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (delta === 'same') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await wait(70);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await wait(70);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {}
}

interface Props {
  venueId: string;
  energyLevel?: string | null;
  lastRatedMinsAgo?: number | null;
  watchersNow?: number | null;
  isInsideVenue: boolean;
  onRefreshed?: (result: any) => void;
}

export default function PulseCheckCard({
  venueId, energyLevel, lastRatedMinsAgo, watchersNow, isInsideVenue, onRefreshed,
}: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [busy, setBusy] = useState<Delta | null>(null);
  const [result, setResult] = useState<{ score: number | null; level: string | null } | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const drain = useRef(new Animated.Value(1)).current;
  const press = useRef<Record<Delta, Animated.Value>>({
    cooling: new Animated.Value(1),
    same: new Animated.Value(1),
    hotter: new Animated.Value(1),
  }).current;

  const stale = lastRatedMinsAgo != null && lastRatedMinsAgo >= PROMPT_AFTER_MINUTES;
  const visible = isInsideVenue && stale && !gone;

  // Arrive, rather than blink into existence.
  useEffect(() => {
    if (!visible) return;
    Animated.spring(enter, { toValue: 1, tension: 62, friction: 10, useNativeDriver: true }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();

    // The bar drains toward the moment this reading stops being true.
    const leftMs = Math.max(0, (READING_LIFESPAN_MINUTES - (lastRatedMinsAgo ?? 0)) * 60000);
    drain.setValue(leftMs > 0 ? 1 : 0);
    if (leftMs > 0) {
      Animated.timing(drain, {
        toValue: 0, duration: leftMs, easing: Easing.linear, useNativeDriver: true,
      }).start();
    }
    return () => loop.stop();
  }, [visible]);

  if (!visible) return null;

  const submit = async (delta: Delta) => {
    if (busy) return;
    setBusy(delta);
    setError(null);
    Haptics.selectionAsync().catch(() => {});
    Animated.sequence([
      Animated.timing(press[delta], { toValue: 0.93, duration: 90, useNativeDriver: true }),
      Animated.spring(press[delta], { toValue: 1, tension: 300, friction: 12, useNativeDriver: true }),
    ]).start();

    try {
      const coordinates = await getBoltCoordinates();
      const res = await fetch(`${API_URL}/api/venues/${venueId}/pulse-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ delta, coordinates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail || 'Could not send that. Try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setBusy(null);
        return;
      }
      const data = await res.json();
      await haptic(delta);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // The payoff: show the number moving because of them, then leave.
      setResult({ score: data.venue_vibe_score ?? null, level: data.energy_level ?? null });
      onRefreshed?.(data);
      setTimeout(() => {
        Animated.timing(enter, {
          toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }).start(() => setGone(true));
      }, 1900);
    } catch {
      setError('No connection. Try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    setBusy(null);
  };

  const shell = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  // Confirmation: the reason it was worth two seconds.
  if (result) {
    return (
      <Animated.View style={[styles.card, styles.done, shell]}>
        <Ionicons name="checkmark-circle" size={26} color={UI.accent} />
        <Text style={styles.doneTitle}>
          {result.score != null ? `Now reading ${Math.round(result.score)}%` : 'Reading refreshed'}
        </Text>
        <Text style={styles.doneSub}>
          {result.level
            ? `${String(result.level).toUpperCase()} · yours is the freshest read`
            : 'Yours is the freshest read'}
        </Text>
      </Animated.View>
    );
  }

  const reads = (energyLevel || 'quiet').toUpperCase();
  const watching = watchersNow ?? 0;

  const Btn = ({ d, label, tint }: { d: Delta; label: string; tint: string }) => (
    <Animated.View style={{ flex: 1, transform: [{ scale: press[d] }] }}>
      <TouchableOpacity
        style={[styles.btn, d === 'hotter' && styles.btnHotShell]}
        onPress={() => submit(d)}
        disabled={busy !== null}
        activeOpacity={0.85}
      >
        {d === 'hotter' ? (
          <LinearGradient
            colors={[UI.accent, UI.hot]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Text style={[styles.btnText, { color: d === 'hotter' ? UI.text : tint }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <Animated.View style={[styles.card, shell]}>
      {/* the clock, made visible */}
      <View style={styles.drainTrack}>
        <Animated.View style={[styles.drainFill, { transform: [{ scaleX: drain }] }]} />
      </View>

      <View style={styles.headRow}>
        <Animated.View style={{ opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }}>
          <View style={styles.dot} />
        </Animated.View>
        <Text style={styles.head}>THIS READING IS GOING STALE</Text>
      </View>

      <Text style={styles.question}>
        Still <Text style={styles.reads}>{reads}</Text> in here?
      </Text>

      <View style={styles.row}>
        <Btn d="cooling" label="Cooling" tint={UI.cool} />
        <Btn d="same" label="Same" tint={UI.text} />
        <Btn d="hotter" label="Hotter" tint={UI.text} />
      </View>

      <Text style={styles.why}>
        {watching > 0
          ? `${watching} ${watching === 1 ? 'person is' : 'people are'} watching this room right now.`
          : 'Two seconds keeps this room honest.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: UI.cardBg,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    borderRadius: 12,
    padding: 16,
    paddingTop: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  drainTrack: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  drainFill: {
    height: 2,
    width: '100%',
    backgroundColor: UI.accent,
    // scaleX shrinks from the centre by default; pin it to the left edge
    alignSelf: 'flex-start',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: UI.accent },
  head: { color: UI.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  question: { color: UI.text, fontSize: 19, fontWeight: '700', marginBottom: 14 },
  reads: { color: UI.accent },
  row: { flexDirection: 'row', gap: 9 },
  btn: {
    paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: UI.cardBorder, backgroundColor: UI.btnBg, overflow: 'hidden',
  },
  btnHotShell: { borderColor: 'transparent' },
  btnText: { fontSize: 14, fontWeight: '700' },
  why: { color: UI.muted, fontSize: 11, marginTop: 12, lineHeight: 16 },
  error: { color: UI.accent, fontSize: 11, marginTop: 8 },
  done: { alignItems: 'center', paddingVertical: 24 },
  doneTitle: { color: UI.text, fontSize: 18, fontWeight: '800', marginTop: 10 },
  doneSub: { color: UI.muted, fontSize: 12, marginTop: 5, letterSpacing: 0.4 },
});
