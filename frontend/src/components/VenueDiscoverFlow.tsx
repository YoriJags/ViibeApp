/**
 * VenueDiscoverFlow — Netflix-style curated category discovery.
 * Full-screen immersive flow: Welcome → Category Intro → 5 Venue Cards → ... → Done.
 * Swipe right = 🔥 Fire, left = Skip, anywhere on screen (during venue phase).
 * Groups venues by type, builds recommendation baseline category-by-category.
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

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

const CATEGORY_CFG: Record<string, { label: string; icon: string; color: string; bg: [string, string, string] }> = {
  club:       { label: 'CLUBS',       icon: '🎭', color: '#FF3366', bg: ['#1A0008','#0E000C','#07070F'] },
  lounge:     { label: 'LOUNGES',     icon: '🥂', color: '#9933FF', bg: ['#0F0020','#0A0018','#07070F'] },
  bar:        { label: 'BARS',        icon: '🍸', color: '#FF8C00', bg: ['#1A0800','#0E0600','#07070F'] },
  concert:    { label: 'CONCERTS',    icon: '🎵', color: '#00C853', bg: ['#001A08','#000F05','#07070F'] },
  restaurant: { label: 'RESTAURANTS', icon: '🍽', color: '#3399FF', bg: ['#000A1A','#00060F','#07070F'] },
};

const CATEGORY_ORDER = ['club', 'lounge', 'bar', 'concert', 'restaurant'];

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
}

interface VenueGroup {
  type: string;
  venues: Venue[];
}

interface Props {
  venues: Venue[];
  onFire: (venueId: string) => void;
  onComplete: () => void;
}

// ─── Welcome Screen ───────────────────────────────────────────────────────────
function WelcomeScreen({
  groups,
  onStart,
  onSkip,
  welcomeScale,
}: {
  groups: VenueGroup[];
  onStart: () => void;
  onSkip: () => void;
  welcomeScale: Animated.Value;
}) {
  return (
    <LinearGradient colors={['#07070F', '#0A0015', '#07070F']} style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={styles.skipAllTop} onPress={onSkip} activeOpacity={0.7}>
        <Text style={styles.skipAllTopText}>Skip</Text>
        <Ionicons name="chevron-forward" size={12} color="#222236" />
      </TouchableOpacity>

      <View style={styles.welcomeContent}>
        <Animated.Text style={[styles.welcomeLogo, { transform: [{ scale: welcomeScale }] }]}>
          VIIBE
        </Animated.Text>

        <Text style={styles.welcomeHeadline}>Tonight's scene is live.</Text>
        <Text style={styles.welcomeSub}>
          Discover the city's best spots before they peak.
        </Text>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.welcomeChips}
          style={{ marginTop: 24, marginBottom: 8 }}
        >
          {groups.map((g) => {
            const cfg = CATEGORY_CFG[g.type];
            if (!cfg) return null;
            return (
              <View key={g.type} style={[styles.welcomeChip, { borderColor: cfg.color + '40' }]}>
                <Text style={styles.welcomeChipIcon}>{cfg.icon}</Text>
                <Text style={[styles.welcomeChipLabel, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.ctaBtn} onPress={onStart} activeOpacity={0.85}>
          <LinearGradient
            colors={['#FF3366', '#9933FF']}
            style={styles.ctaBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.ctaBtnText}>LET'S EXPLORE  →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkip} style={{ marginTop: 16 }} activeOpacity={0.6}>
          <Text style={styles.skipNowText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ─── Category Intro Screen ────────────────────────────────────────────────────
function CategoryIntroScreen({
  group,
  catIdx,
  totalGroups,
  onExplore,
  onSkipCategory,
}: {
  group: VenueGroup;
  catIdx: number;
  totalGroups: number;
  onExplore: () => void;
  onSkipCategory: () => void;
}) {
  const cfg = CATEGORY_CFG[group.type] ?? { label: group.type.toUpperCase(), icon: '📍', color: '#FF3366', bg: ['#07070F', '#07070F', '#07070F'] as [string,string,string] };

  // Compute avg vibe score
  const avgScore = group.venues.length
    ? Math.round(group.venues.reduce((s, v) => s + (v.current_vibe_score ?? 0), 0) / group.venues.length)
    : 0;

  // Energy distribution
  const energyDist: Record<string, number> = {};
  group.venues.forEach(v => {
    const key = v.energy_level ?? 'quiet';
    energyDist[key] = (energyDist[key] || 0) + 1;
  });
  const energyPills = Object.entries(energyDist)
    .filter(([, count]) => count > 0)
    .slice(0, 4);

  return (
    <LinearGradient colors={cfg.bg} style={StyleSheet.absoluteFill}>
      {/* Counter */}
      <Text style={styles.catCounter}>{catIdx + 1} / {totalGroups}</Text>

      <View style={styles.catIntroContent}>
        <Text style={styles.catIntroIcon}>{cfg.icon}</Text>
        <Text style={[styles.catIntroLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <Text style={styles.catIntroTonight}>TONIGHT</Text>

        {/* Stats */}
        <Text style={styles.catIntroStats}>
          {group.venues.length} venue{group.venues.length !== 1 ? 's' : ''} · avg {avgScore} vibe
        </Text>

        {/* Energy pills */}
        <View style={styles.energyDistRow}>
          {energyPills.map(([level, count]) => {
            const e = ENERGY[level] ?? ENERGY['quiet'];
            return (
              <View key={level} style={[styles.energyDistPill, { borderColor: e.color + '40' }]}>
                <View style={[styles.energyDistDot, { backgroundColor: e.color }]} />
                <Text style={[styles.energyDistLabel, { color: e.color }]}>{e.label}</Text>
                <Text style={[styles.energyDistCount, { color: e.color + '80' }]}> ×{count}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.catProgressText}>{group.venues.length} venues to explore</Text>

        <TouchableOpacity style={[styles.ctaBtn, { marginTop: 24 }]} onPress={onExplore} activeOpacity={0.85}>
          <LinearGradient
            colors={[cfg.color, cfg.color + 'AA']}
            style={styles.ctaBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.ctaBtnText}>Explore  →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkipCategory} style={{ marginTop: 14 }} activeOpacity={0.6}>
          <Text style={styles.skipNowText}>Skip category</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ─── Venue Card Body ──────────────────────────────────────────────────────────
function VenueCardBody({ venue, catColor }: { venue: Venue; catColor: string }) {
  const energy = ENERGY[venue.energy_level] ?? ENERGY['quiet'];
  const score = venue.current_vibe_score ?? 0;
  const capacityText = venue.capacity_level === 'full' ? 'Packed' :
    venue.capacity_level === 'vibrant' ? 'Vibrant' :
    venue.capacity_level === 'moderate' ? 'Some crowd' : null;

  return (
    <LinearGradient
      colors={[catColor + '1E', '#0D0D1E', '#07070F']}
      style={styles.cardGrad}
    >
      {/* Top accent line */}
      <View style={[styles.accentLine, { backgroundColor: catColor }]} />

      {/* Visual zone */}
      <View style={styles.visualZone}>
        <View style={[styles.orbRing, { borderColor: catColor + '30' }]}>
          <View style={[styles.orbCore, { backgroundColor: catColor + '15' }]} />
        </View>
        {/* Energy pill overlaid on ring */}
        <View style={[styles.energyPill, { backgroundColor: energy.color + '1A', borderColor: energy.color + '40' }]}>
          <View style={[styles.energyDot, { backgroundColor: energy.color }]} />
          <Text style={[styles.energyLabel, { color: energy.color }]}>{energy.label}</Text>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.cardContent}>
        <Text style={styles.venueName} numberOfLines={2}>{venue.name}</Text>
        {venue.area ? <Text style={styles.venueArea}>{venue.area}</Text> : null}

        {/* Vibe score bar */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreTrack}>
            <View style={[styles.scoreFill, { width: `${Math.min(score, 100)}%` as any, backgroundColor: catColor }]} />
          </View>
          <Text style={[styles.scoreNum, { color: catColor }]}>{score}</Text>
        </View>

        {/* Info chips */}
        <View style={styles.chips}>
          {venue.music_genre ? (
            <View style={[styles.chip, { borderColor: catColor + '35' }]}>
              <Ionicons name="musical-notes" size={11} color={catColor} />
              <Text style={[styles.chipText, { color: catColor }]}>{venue.music_genre}</Text>
            </View>
          ) : null}
          {capacityText ? (
            <View style={styles.chip}>
              <Ionicons name="people" size={11} color="#555" />
              <Text style={styles.chipTextDim}>{capacityText}</Text>
            </View>
          ) : null}
          {venue.entry_fee ? (
            <View style={styles.chip}>
              <Ionicons name="ticket" size={11} color="#555" />
              <Text style={styles.chipTextDim}>{venue.entry_fee}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

// ─── Done Screen ──────────────────────────────────────────────────────────────
function DoneScreen({ fireCount, onComplete }: { fireCount: number; onComplete: () => void }) {
  return (
    <LinearGradient colors={['#0A0015', '#07070F', '#000A05']} style={StyleSheet.absoluteFill}>
      <View style={styles.doneWrap}>
        <Text style={styles.doneEmoji}>
          {fireCount >= 3 ? '🔥' : fireCount >= 1 ? '✨' : '👀'}
        </Text>
        <Text style={styles.doneHeadline}>
          {fireCount >= 3 ? 'Tonight has a plan.' : fireCount >= 1 ? 'Scene logged.' : 'Nothing grabbed you?'}
        </Text>
        <Text style={styles.doneSub}>
          {fireCount > 0
            ? `${fireCount} venue${fireCount > 1 ? 's' : ''} saved to your radar.\nVIIBE learns your taste.`
            : 'New venues drop every hour.'}
        </Text>
        <TouchableOpacity style={styles.enterBtn} onPress={onComplete} activeOpacity={0.85}>
          <LinearGradient
            colors={['#FF3366', '#9933FF']}
            style={styles.enterBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.enterBtnText}>ENTER THE SCENE  →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VenueDiscoverFlow({ venues, onFire, onComplete }: Props) {
  const [phase, setPhase] = useState<'welcome' | 'category_intro' | 'venue' | 'done'>('welcome');
  const [catIdx, setCatIdx] = useState(0);
  const [venueIdx, setVenueIdx] = useState(0);
  const [fireCount, setFireCount] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'fire' | 'skip' | null>(null);

  const position = useRef(new Animated.ValueXY()).current;
  const nextScale = useRef(new Animated.Value(0.93)).current;
  const nextOpacity = useRef(new Animated.Value(0.5)).current;
  const screenFade = useRef(new Animated.Value(1)).current;
  const cardEntrance = useRef(new Animated.Value(60)).current;
  const glowPulse = useRef(new Animated.Value(0.7)).current;
  const welcomeScale = useRef(new Animated.Value(1)).current;

  // Group venues by type
  const groups: VenueGroup[] = useMemo(() => {
    const map: Record<string, Venue[]> = {};
    venues.forEach(v => {
      const type = (v as any).venue_type;
      if (!type || !CATEGORY_ORDER.includes(type)) return;
      if (!map[type]) map[type] = [];
      map[type].push(v);
    });
    return CATEGORY_ORDER
      .filter(t => map[t] && map[t].length > 0)
      .map(t => ({
        type: t,
        venues: map[t].sort((a, b) => (b.current_vibe_score ?? 0) - (a.current_vibe_score ?? 0)).slice(0, 5),
      }));
  }, [venues]);

  const currentGroup = groups[catIdx];
  const catColor = currentGroup ? (CATEGORY_CFG[currentGroup.type]?.color ?? '#FF3366') : '#FF3366';
  const catBg = currentGroup ? (CATEGORY_CFG[currentGroup.type]?.bg ?? (['#07070F','#07070F','#07070F'] as [string,string,string])) : (['#07070F','#07070F','#07070F'] as [string,string,string]);

  const currentVenue = currentGroup?.venues[venueIdx] ?? null;
  const nextVenue = currentGroup?.venues[venueIdx + 1] ?? null;

  // Progress tracking
  const completedVenues = useMemo(() => {
    const prevCats = groups.slice(0, catIdx).reduce((s, g) => s + g.venues.length, 0);
    return prevCats + (phase === 'venue' ? venueIdx : 0);
  }, [groups, catIdx, venueIdx, phase]);

  const totalVenues = useMemo(() => groups.reduce((s, g) => s + g.venues.length, 0), [groups]);

  // Welcome logo pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(welcomeScale, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(welcomeScale, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Glow pulse (venue phase)
  useEffect(() => {
    if (phase !== 'venue') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1,   duration: 2500, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.5, duration: 2500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, catIdx]);

  // Card entrance animation
  useEffect(() => {
    if (phase !== 'venue') return;
    cardEntrance.setValue(60);
    Animated.spring(cardEntrance, { toValue: 0, tension: 58, friction: 14, useNativeDriver: true }).start();
  }, [venueIdx, catIdx, phase]);

  // Category intro auto-advance after 2000ms
  useEffect(() => {
    if (phase !== 'category_intro') return;
    const timer = setTimeout(() => setPhase('venue'), 2000);
    return () => clearTimeout(timer);
  }, [phase, catIdx]);

  // Swipe stamps opacity
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

  const advanceVenue = (fired: boolean) => {
    if (fired && currentVenue) onFire(currentVenue.id);
    if (fired) setFireCount(c => c + 1);

    position.setValue({ x: 0, y: 0 });
    nextScale.setValue(0.93);
    nextOpacity.setValue(0.5);
    setSwipeDir(null);

    const nextVenueIdx = venueIdx + 1;
    if (currentGroup && nextVenueIdx < currentGroup.venues.length) {
      setVenueIdx(nextVenueIdx);
    } else {
      const nextCatIdx = catIdx + 1;
      if (nextCatIdx < groups.length) {
        setCatIdx(nextCatIdx);
        setVenueIdx(0);
        setPhase('category_intro');
      } else {
        setPhase('done');
      }
    }
  };

  const animateFire = () => {
    if (phase !== 'venue') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(position, { toValue: { x: W * 1.6, y: -100 }, duration: 280, useNativeDriver: true }),
      Animated.timing(nextScale,   { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(nextOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start(() => advanceVenue(true));
  };

  const animateSkip = () => {
    if (phase !== 'venue') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(position, { toValue: { x: -W * 1.6, y: -100 }, duration: 260, useNativeDriver: true }),
      Animated.timing(nextScale,   { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(nextOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start(() => advanceVenue(false));
  };

  const skipCategory = () => {
    const nextCatIdx = catIdx + 1;
    if (nextCatIdx < groups.length) {
      setCatIdx(nextCatIdx);
      setVenueIdx(0);
      setPhase('category_intro');
    } else {
      setPhase('done');
    }
  };

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
          animateFire();
        } else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.85) {
          animateSkip();
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

  // ─── Phase: DONE ───────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <DoneScreen fireCount={fireCount} onComplete={onComplete} />
      </View>
    );
  }

  // ─── Phase: WELCOME ────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <WelcomeScreen
          groups={groups}
          onStart={() => {
            if (groups.length === 0) {
              setPhase('done');
            } else {
              setPhase('category_intro');
            }
          }}
          onSkip={onComplete}
          welcomeScale={welcomeScale}
        />
      </View>
    );
  }

  // ─── Phase: CATEGORY_INTRO ─────────────────────────────────────────────────
  if (phase === 'category_intro' && currentGroup) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <CategoryIntroScreen
          group={currentGroup}
          catIdx={catIdx}
          totalGroups={groups.length}
          onExplore={() => setPhase('venue')}
          onSkipCategory={skipCategory}
        />
      </View>
    );
  }

  // ─── Phase: VENUE ──────────────────────────────────────────────────────────
  if (!currentVenue) return null;

  return (
    <Animated.View
      style={[styles.root, { opacity: screenFade }]}
      {...(phase === 'venue' ? panResponder.panHandlers : {})}
    >
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <LinearGradient colors={catBg} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[styles.ambientGlow, { backgroundColor: catColor + '18', transform: [{ scale: glowPulse }] }]}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.skipXBtn} onPress={onComplete} activeOpacity={0.7}>
          <Text style={styles.skipXText}>Skip all</Text>
          <Ionicons name="chevron-forward" size={12} color="#222236" />
        </TouchableOpacity>

        {/* Overall progress bar */}
        <View style={styles.overallProgressTrack}>
          <View style={[styles.overallProgressFill, {
            width: `${totalVenues > 0 ? (completedVenues / totalVenues) * 100 : 0}%` as any,
            backgroundColor: catColor,
          }]} />
        </View>

        <Text style={styles.progressCount}>{completedVenues}/{totalVenues}</Text>
      </View>

      {/* Card stack */}
      <Animated.View style={[styles.slideContainer, { transform: [{ translateY: cardEntrance }] }]}>
        {/* Next card behind */}
        {nextVenue && (
          <Animated.View style={[styles.card, styles.cardBehind, { transform: [{ scale: nextScale }], opacity: nextOpacity }]}>
            <VenueCardBody venue={nextVenue} catColor={catColor} />
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

          <VenueCardBody venue={currentVenue} catColor={catColor} />
        </Animated.View>
      </Animated.View>

      {/* Venue dots */}
      {currentGroup && (
        <View style={styles.venueDots}>
          {currentGroup.venues.map((_, i) => (
            <View
              key={i}
              style={[
                styles.venueDot,
                i < venueIdx && { backgroundColor: catColor + '40', width: 8 },
                i === venueIdx && { backgroundColor: catColor, width: 20 },
                i > venueIdx && { backgroundColor: '#111120' },
              ]}
            />
          ))}
        </View>
      )}

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.skipBtn, swipeDir === 'skip' && styles.actionBtnActive]}
          onPress={animateSkip}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={26} color={swipeDir === 'skip' ? '#FF6644' : '#2A2A3E'} />
        </TouchableOpacity>

        <View style={styles.hintWrap}>
          <Text style={styles.hintText}>swipe anywhere to rate</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.fireBtn, swipeDir === 'fire' && styles.actionBtnFireActive]}
          onPress={animateFire}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 26 }}>🔥</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// Adaptive card height: fills space between top chrome (80pt) and bottom chrome (145pt)
// Minimum 340, maximum 60% of screen — works on SE (667pt) through Pro Max (932pt)
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

  // ── Welcome ─────────────────────────────────────────────────────────────────
  skipAllTop: {
    position: 'absolute',
    top: 54,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    zIndex: 10,
  },
  skipAllTopText: { color: '#222236', fontSize: 12, fontWeight: '600' },
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  welcomeLogo: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FF3366',
    letterSpacing: 12,
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 20,
  },
  welcomeHeadline: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  welcomeSub: {
    fontSize: 15,
    color: '#3A3A5A',
    textAlign: 'center',
    lineHeight: 22,
  },
  welcomeChips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  welcomeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#0C0C18',
  },
  welcomeChipIcon: { fontSize: 14 },
  welcomeChipLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // ── Category Intro ───────────────────────────────────────────────────────────
  catCounter: {
    position: 'absolute',
    top: 54,
    right: 18,
    color: '#2A2A4A',
    fontSize: 12,
    fontWeight: '700',
    zIndex: 10,
  },
  catIntroContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  catIntroIcon: { fontSize: H < 700 ? 52 : 68, marginBottom: 10 },
  catIntroLabel: {
    fontSize: H < 700 ? 38 : 48,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 4,
  },
  catIntroTonight: {
    fontSize: 13,
    color: '#2A2A4A',
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 16,
  },
  catIntroStats: {
    fontSize: 13,
    color: '#3A3A5A',
    fontWeight: '600',
    marginBottom: 16,
  },
  energyDistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  energyDistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#0C0C18',
  },
  energyDistDot: { width: 5, height: 5, borderRadius: 3 },
  energyDistLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  energyDistCount: { fontSize: 10, fontWeight: '600' },
  catProgressText: {
    fontSize: 11,
    color: '#2A2A4A',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // ── CTA button (shared) ──────────────────────────────────────────────────────
  ctaBtn: { borderRadius: 16, overflow: 'hidden' },
  ctaBtnGrad: { paddingHorizontal: 32, paddingVertical: 16, alignItems: 'center', flexDirection: 'row' },
  ctaBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  skipNowText: { color: '#222236', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // ── Top bar (venue phase) ────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  skipXBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  skipXText: { color: '#222236', fontSize: 12, fontWeight: '600' },
  overallProgressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: '#111120',
    borderRadius: 1,
    overflow: 'hidden',
  },
  overallProgressFill: { height: 2, borderRadius: 1 },
  progressCount: { color: '#2A2A4A', fontSize: 11, fontWeight: '700' },

  // ── Card stack ───────────────────────────────────────────────────────────────
  // Absolute bounds: top clears status bar + topBar, bottom clears dots + actionBar
  slideContainer: {
    position: 'absolute',
    top: 82,
    bottom: 148,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: W - 24,
    height: CARD_H,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1A1A2E',
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  cardBehind: { zIndex: 0 },
  cardGrad: { flex: 1 },
  accentLine: { height: 3 },
  visualZone: {
    height: H < 700 ? 90 : 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  energyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  energyDot: { width: 6, height: 6, borderRadius: 3 },
  energyLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },

  // Card content — spacing scales down on small screens
  cardContent: { flex: 1, paddingHorizontal: 22, paddingTop: 4, paddingBottom: 14, justifyContent: 'center' },
  venueName: { fontSize: H < 700 ? 28 : 34, fontWeight: '900', color: '#FFF', letterSpacing: -0.8, lineHeight: H < 700 ? 32 : 38, marginBottom: 4 },
  venueArea: { fontSize: 12, color: '#3A3A5A', fontWeight: '500', marginBottom: H < 700 ? 10 : 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: H < 700 ? 10 : 16 },
  scoreTrack: { flex: 1, height: 3, backgroundColor: '#0E0E1C', borderRadius: 2, overflow: 'hidden' },
  scoreFill: { height: 3, borderRadius: 2 },
  scoreNum: { fontSize: 14, fontWeight: '900', width: 28, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0C0C1A',
    borderWidth: 1,
    borderColor: '#1C1C2E',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { fontSize: 11, fontWeight: '600' },
  chipTextDim: { color: '#404058', fontSize: 11, fontWeight: '600' },

  // Swipe stamps
  stamp: {
    position: 'absolute',
    zIndex: 20,
    top: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 10,
  },
  stampFire: { right: 20, borderColor: '#FF336670', backgroundColor: '#FF336615', transform: [{ rotate: '12deg' }] },
  stampSkip: { left: 20, borderColor: '#44444455', backgroundColor: '#11111A', transform: [{ rotate: '-12deg' }] },
  stampFireText: { fontSize: 17, fontWeight: '900', color: '#FF3366' },
  stampSkipText: { fontSize: 14, fontWeight: '900', color: '#333348' },

  // Venue dots — sits between card bottom and action bar
  venueDots: {
    position: 'absolute',
    bottom: 126,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  venueDot: { height: 4, width: 8, borderRadius: 2 },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  skipBtn: { backgroundColor: '#0A0A16', borderColor: '#16162A' },
  fireBtn: { backgroundColor: '#FF336610', borderColor: '#FF336630' },
  actionBtnActive: { borderColor: '#FF664420', backgroundColor: '#1A0800' },
  actionBtnFireActive: { borderColor: '#FF336660', backgroundColor: '#FF336618' },
  hintWrap: { flex: 1, alignItems: 'center' },
  hintText: { color: '#1C1C2E', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  // Done screen
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  doneEmoji: { fontSize: 64, marginBottom: 8 },
  doneHeadline: { fontSize: 28, fontWeight: '900', color: '#EEE', textAlign: 'center', letterSpacing: -0.5 },
  doneSub: { fontSize: 15, color: '#333348', textAlign: 'center', lineHeight: 24 },
  enterBtn: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  enterBtnGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 16 },
  enterBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
});
