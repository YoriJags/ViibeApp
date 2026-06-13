/**
 * VenueDiscoverFlow — Quick random swipe deck.
 * No categories, no welcome. Just shuffle all venues and swipe.
 * Right = 🔥 Fire, Left = Skip. Swipe anywhere on screen.
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Placeholder club images — seeded by venue ID ─────────────────────────────
const CLUB_PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80',
  'https://images.unsplash.com/photo-1571266028243-d220c8b77883?w=600&q=80',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=600&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
];

function getVenueImage(venue: Venue): string {
  if (venue.cover_image_url) return venue.cover_image_url;
  if (venue.photo_base64) return `data:image/jpeg;base64,${venue.photo_base64}`;
  // Deterministic placeholder — same venue always gets same photo
  const hash = venue.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CLUB_PLACEHOLDERS[hash % CLUB_PLACEHOLDERS.length];
}

const { width: W, height: H } = Dimensions.get('window');
const SWIPE_THRESHOLD = W * 0.28;

const ENERGY: Record<string, { color: string; label: string }> = {
  peak:    { color: '#FF3366', label: 'PEAK'    },
  lit:     { color: '#FF8C00', label: 'LIT'     },
  charged: { color: '#9933FF', label: 'CHARGED' },
  warming: { color: '#6655FF', label: 'WARMING' },
  chill:   { color: '#3399FF', label: 'CHILL'   },
  quiet:   { color: '#444466', label: 'QUIET'   },
};

interface Venue {
  id: string;
  name: string;
  area?: string;
  energy_level: string;
  current_vibe_score: number;
  music_genre?: string;
  entry_fee?: string;
  capacity_level?: string;
  venue_type?: string;
  photo_base64?: string;
  cover_image_url?: string;
}

interface Props {
  venues: Venue[];
  onFire: (venueId: string) => void;
  onComplete: () => void;
}

// ─── Venue Card Body ──────────────────────────────────────────────────────────
function VenueCardBody({ venue }: { venue: Venue }) {
  const energy = ENERGY[venue.energy_level] ?? ENERGY.quiet;
  const score = venue.current_vibe_score ?? 0;
  const scoreColor = score >= 80 ? '#00E676' : score >= 60 ? '#FFD700' : score >= 40 ? '#FF8C00' : '#666';
  const imgUrl = getVenueImage(venue);

  return (
    <View style={styles.cardInner}>
      {/* Hero image — fills entire card */}
      <Image source={{ uri: imgUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Deep gradient scrim — transparent top → opaque dark bottom */}
      <LinearGradient
        colors={['rgba(7,7,15,0.15)', 'rgba(7,7,15,0.55)', 'rgba(7,7,15,0.92)', '#07070F']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content — anchored to bottom */}
      <View style={styles.cardContent}>
        {/* Energy badge */}
        <View style={[styles.energyBadge, { borderColor: energy.color + '80', backgroundColor: energy.color + '22' }]}>
          <View style={[styles.energyDot, { backgroundColor: energy.color }]} />
          <Text style={[styles.energyLabel, { color: energy.color }]}>{energy.label}</Text>
        </View>

        {/* Venue name */}
        <Text style={styles.venueName} numberOfLines={2}>{venue.name}</Text>
        {venue.area ? <Text style={styles.venueArea}>{venue.area}</Text> : null}

        {/* Score */}
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{score}</Text>
          <Text style={styles.scoreLabel}>VIBE</Text>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          {venue.music_genre ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaText}>🎵 {venue.music_genre.split('/')[0].trim()}</Text>
            </View>
          ) : null}
          {venue.entry_fee ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaText}>{venue.entry_fee}</Text>
            </View>
          ) : null}
          {venue.capacity_level ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaText}>{venue.capacity_level === 'full' ? '🔥 Full' : venue.capacity_level === 'vibrant' ? '⚡ Vibrant' : '🌙 Easy entry'}</Text>
            </View>
          ) : null}
        </View>

        {/* Hint */}
        <Text style={styles.swipeHint}>swipe anywhere</Text>
      </View>
    </View>
  );
}

// ─── Done Screen ─────────────────────────────────────────────────────────────
function DoneScreen({ fireCount, onComplete }: { fireCount: number; onComplete: () => void }) {
  return (
    <LinearGradient colors={['#07070F', '#0A0015', '#07070F']} style={[StyleSheet.absoluteFill, styles.doneWrap]}>
      <Text style={styles.doneEmoji}>{fireCount > 0 ? '🔥' : '👀'}</Text>
      <Text style={styles.doneTitle}>{fireCount > 0 ? `${fireCount} spot${fireCount !== 1 ? 's' : ''} fired` : 'Noted.'}</Text>
      <Text style={styles.doneSub}>
        {fireCount > 0
          ? 'Your picks shape your feed. Get out there.'
          : 'Explore the map to find your scene.'}
      </Text>
      <TouchableOpacity style={styles.doneBtn} onPress={onComplete} activeOpacity={0.8}>
        <LinearGradient colors={['#FF3366', '#9933FF']} style={styles.doneBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={styles.doneBtnText}>See the Scene  →</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VenueDiscoverFlow({ venues, onFire, onComplete }: Props) {
  const insets = useSafeAreaInsets();

  // Shuffle venues once on mount
  const shuffled = useMemo(() => {
    const arr = [...venues];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 15); // cap at 15 cards
  }, []);

  const [cardIdx, setCardIdx] = useState(0);
  const [fireCount, setFireCount] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'fire' | 'skip' | null>(null);
  const [done, setDone] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const nextScale = useRef(new Animated.Value(0.93)).current;
  const nextOpacity = useRef(new Animated.Value(0.5)).current;
  const cardEntrance = useRef(new Animated.Value(60)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;

  // The PanResponder is created once (stable), so its callbacks would close
  // over the first render's handlers and a frozen cardIdx. Route swipe releases
  // through this ref so the gesture always advances the CURRENT card.
  const swipeHandlers = useRef<{ fire: () => void; skip: () => void }>({ fire: () => {}, skip: () => {} });

  const currentVenue = shuffled[cardIdx] ?? null;
  const nextVenue = shuffled[cardIdx + 1] ?? null;

  // Card entrance slide-up
  useEffect(() => {
    cardEntrance.setValue(60);
    Animated.spring(cardEntrance, { toValue: 0, tension: 58, friction: 14, useNativeDriver: true }).start();
  }, [cardIdx]);

  // Ambient glow pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.5, duration: 2500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const energy = currentVenue ? (ENERGY[currentVenue.energy_level] ?? ENERGY.quiet) : ENERGY.quiet;

  const fireOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });
  const skipOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });
  const cardRotate = position.x.interpolate({
    inputRange: [-W, 0, W],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const advance = (fired: boolean) => {
    if (fired && currentVenue) {
      onFire(currentVenue.id);
      setFireCount(c => c + 1);
    }
    position.setValue({ x: 0, y: 0 });
    nextScale.setValue(0.93);
    nextOpacity.setValue(0.5);
    setSwipeDir(null);
    const next = cardIdx + 1;
    if (next >= shuffled.length) {
      setDone(true);
      // Auto-dismiss after 2.5s so the overlay never blocks the main UI
      setTimeout(() => onComplete(), 2500);
    } else {
      setCardIdx(next);
    }
  };

  const animateFire = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(position, { toValue: { x: W * 1.6, y: -100 }, duration: 280, useNativeDriver: true }),
      Animated.timing(nextScale,   { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(nextOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start(() => advance(true));
  };

  const animateSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(position, { toValue: { x: -W * 1.6, y: -100 }, duration: 260, useNativeDriver: true }),
      Animated.timing(nextScale,   { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(nextOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start(() => advance(false));
  };

  // Refresh the ref every render so the stable PanResponder calls the latest
  // closures (correct cardIdx / currentVenue), fixing the stuck-deck bug.
  swipeHandlers.current.fire = animateFire;
  swipeHandlers.current.skip = animateSkip;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 0.6,
      onPanResponderMove: (_, g) => {
        position.setValue({ x: g.dx, y: g.dy * 0.25 });
        const progress = Math.min(Math.abs(g.dx) / SWIPE_THRESHOLD, 1);
        nextScale.setValue(0.93 + progress * 0.07);
        nextOpacity.setValue(0.5 + progress * 0.5);
        setSwipeDir(g.dx > 30 ? 'fire' : g.dx < -30 ? 'skip' : null);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD || g.vx > 0.85) {
          swipeHandlers.current.fire();
        } else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.85) {
          swipeHandlers.current.skip();
        } else {
          setSwipeDir(null);
          Animated.parallel([
            Animated.spring(position,    { toValue: { x: 0, y: 0 }, tension: 80, friction: 10, useNativeDriver: true }),
            Animated.spring(nextScale,   { toValue: 0.93, tension: 80, friction: 10, useNativeDriver: true }),
            Animated.spring(nextOpacity, { toValue: 0.5,  tension: 80, friction: 10, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  if (done || !currentVenue) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <DoneScreen fireCount={fireCount} onComplete={onComplete} />
      </View>
    );
  }

  return (
    <Animated.View style={styles.root} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <LinearGradient colors={['#0A000F', '#07070F', '#07070F']} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[styles.ambientGlow, { backgroundColor: energy.color + '18', transform: [{ scale: glowPulse }] }]}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.skipBtn} onPress={onComplete} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip all</Text>
          <Ionicons name="chevron-forward" size={12} color="#333355" />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((cardIdx) / shuffled.length) * 100}%` as any, backgroundColor: energy.color }]} />
        </View>
        <Text style={styles.progressCount}>{cardIdx + 1}/{shuffled.length}</Text>
      </View>

      {/* Card stack */}
      <Animated.View style={[styles.slideContainer, { transform: [{ translateY: cardEntrance }] }]}>
        {/* Next card behind */}
        {nextVenue && (
          <Animated.View style={[styles.card, styles.cardBehind, { transform: [{ scale: nextScale }], opacity: nextOpacity }]}>
            <VenueCardBody venue={nextVenue} />
          </Animated.View>
        )}

        {/* Active card */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate: cardRotate },
              ],
            },
          ]}
        >
          {/* FIRE stamp */}
          <Animated.View style={[styles.stamp, styles.stampFire, { opacity: fireOpacity }]}>
            <Text style={styles.stampFireText}>🔥 FIRE</Text>
          </Animated.View>

          {/* SKIP stamp */}
          <Animated.View style={[styles.stamp, styles.stampSkip, { opacity: skipOpacity }]}>
            <Text style={styles.stampSkipText}>SKIP</Text>
          </Animated.View>

          <VenueCardBody venue={currentVenue} />
        </Animated.View>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {shuffled.slice(0, Math.min(shuffled.length, 10)).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < cardIdx && { backgroundColor: energy.color + '40', width: 8 },
              i === cardIdx && { backgroundColor: energy.color, width: 20 },
              i > cardIdx && { backgroundColor: '#111120' },
            ]}
          />
        ))}
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.skipActionBtn, swipeDir === 'skip' && styles.actionBtnSkipActive]}
          onPress={animateSkip}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={26} color={swipeDir === 'skip' ? '#FF6644' : '#2A2A3E'} />
        </TouchableOpacity>

        <View style={styles.hintWrap}>
          <Text style={styles.hintText}>swipe to rate</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.fireActionBtn, swipeDir === 'fire' && styles.actionBtnFireActive]}
          onPress={animateFire}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 26 }}>🔥</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const CARD_H = Math.max(340, Math.min(H * 0.60, H - 240));

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: '#07070F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: W * 1.2,
    height: W * 1.2,
    borderRadius: W * 0.6,
    top: H * 0.1,
    alignSelf: 'center',
  },

  // ── Top bar ─────────────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  skipText: { color: '#333355', fontSize: 12, fontWeight: '600' },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: '#111120',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
  progressCount: {
    fontSize: 11,
    color: '#2A2A4A',
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },

  // ── Cards ────────────────────────────────────────────────────────────────────
  slideContainer: {
    width: W - 32,
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  card: {
    position: 'absolute',
    width: W - 32,
    height: CARD_H,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  cardBehind: {
    zIndex: 0,
  },
  cardInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1A1A2E',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
    gap: 10,
  },

  // Stamps
  stamp: {
    position: 'absolute',
    top: 32,
    zIndex: 10,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  stampFire: {
    right: 20,
    borderColor: '#FF3366',
    backgroundColor: '#FF336610',
    transform: [{ rotate: '15deg' }],
  },
  stampSkip: {
    left: 20,
    borderColor: '#666688',
    backgroundColor: '#66668810',
    transform: [{ rotate: '-15deg' }],
  },
  stampFireText: { fontSize: 18, fontWeight: '900', color: '#FF3366' },
  stampSkipText: { fontSize: 18, fontWeight: '900', color: '#666688' },

  // Card content
  energyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  energyDot: { width: 6, height: 6, borderRadius: 3 },
  energyLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  venueName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#EEEEEE',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  venueArea: {
    fontSize: 14,
    color: '#3A3A5A',
    fontWeight: '600',
    marginTop: -4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  scoreNum: { fontSize: 36, fontWeight: '900' },
  scoreLabel: { fontSize: 11, color: '#3A3A5A', fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaChip: {
    backgroundColor: '#111120',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#1A1A2E',
  },
  metaText: { fontSize: 11, color: '#555577', fontWeight: '600' },
  swipeHint: {
    fontSize: 10,
    color: '#1A1A2E',
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 8,
    textAlign: 'center',
  },

  // ── Progress dots ─────────────────────────────────────────────────────────────
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    marginTop: 14,
    height: 8,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },

  // ── Action bar ────────────────────────────────────────────────────────────────
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 18,
    paddingHorizontal: 32,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  skipActionBtn: {
    borderColor: '#1A1A2E',
    backgroundColor: '#0C0C18',
  },
  fireActionBtn: {
    borderColor: '#1A1A2E',
    backgroundColor: '#0C0C18',
  },
  actionBtnSkipActive: {
    borderColor: '#FF664440',
    backgroundColor: '#FF664415',
  },
  actionBtnFireActive: {
    borderColor: '#FF336640',
    backgroundColor: '#FF336615',
  },
  hintWrap: { flex: 1, alignItems: 'center' },
  hintText: { fontSize: 10, color: '#1A1A2E', fontWeight: '600', letterSpacing: 1 },

  // ── Done screen ───────────────────────────────────────────────────────────────
  doneWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  doneEmoji: { fontSize: 60, marginBottom: 8 },
  doneTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#EEEEEE',
    textAlign: 'center',
  },
  doneSub: {
    fontSize: 15,
    color: '#3A3A5A',
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    marginTop: 16,
    borderRadius: 28,
    overflow: 'hidden',
    width: W * 0.65,
  },
  doneBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
