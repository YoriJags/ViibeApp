/**
 * SwipeRate — Tinder-style venue quick-rating deck.
 * Shows up to 5 unrated venues. Swipe right = Fire, left = Skip.
 * Each fire swipe submits a pulse signal + earns clout.
 * "The fastest way to read the scene."
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, PanResponder,
  StyleSheet, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');
const SWIPE_THRESHOLD = W * 0.32;

const ENERGY_CONFIG: Record<string, { label: string; color: string }> = {
  peak:    { label: 'PEAK',    color: '#FF3366' },
  lit:     { label: 'LIT',     color: '#FF8C00' },
  charged: { label: 'CHARGED', color: '#9933FF' },
  warming: { label: 'WARMING', color: '#6655FF' },
  chill:   { label: 'CHILL',   color: '#3399FF' },
  quiet:   { label: 'QUIET',   color: '#3A3A4E' },
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
}

interface Props {
  visible: boolean;
  venues: Venue[];
  onFire: (venueId: string) => void;
  onClose: () => void;
  isDemoMode?: boolean;
}

export default function SwipeRate({ visible, venues, onFire, onClose, isDemoMode }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fireCount, setFireCount] = useState(0);
  const [done, setDone] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const bgOpac   = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(H)).current;

  const displayVenues = venues.slice(0, 6);

  const fireOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const skipOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const rotate = position.x.interpolate({
    inputRange: [-W, 0, W],
    outputRange: ['-14deg', '0deg', '14deg'],
    extrapolate: 'clamp',
  });

  // Use refs so panResponder's stale closure always calls the latest version
  const advanceRef   = useRef<(fired: boolean) => void>(() => {});
  const swipeFireRef = useRef<() => void>(() => {});
  const swipeSkipRef = useRef<() => void>(() => {});

  advanceRef.current = (fired: boolean) => {
    if (fired) {
      const venue = displayVenues[currentIndex];
      if (venue) onFire(venue.id);
      setFireCount(c => c + 1);
    }
    const next = currentIndex + 1;
    if (next >= displayVenues.length) {
      setDone(true);
    } else {
      setCurrentIndex(next);
    }
  };

  swipeFireRef.current = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(position, {
      toValue: { x: W * 1.5, y: -60 },
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      advanceRef.current(true);
    });
  };

  swipeSkipRef.current = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(position, {
      toValue: { x: -W * 1.5, y: -60 },
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      advanceRef.current(false);
    });
  };

  // Convenience wrappers for button presses (always fresh via refs)
  const swipeFire = () => swipeFireRef.current();
  const swipeSkip = () => swipeSkipRef.current();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 0.8,
      onPanResponderMove: (_, g) => {
        position.setValue({ x: g.dx, y: g.dy * 0.25 });
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD || g.vx > 0.9) {
          swipeFireRef.current();
        } else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.9) {
          swipeSkipRef.current();
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            tension: 80,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setFireCount(0);
      setDone(false);
      position.setValue({ x: 0, y: 0 });
      bgOpac.setValue(0);
      slideY.setValue(H);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(bgOpac, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(slideY, { toValue: 0, tension: 65, friction: 14, useNativeDriver: true }),
        ]).start();
      });
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(bgOpac,  { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: H, duration: 280, useNativeDriver: true }),
    ]).start(onClose);
  };

  const venue  = displayVenues[currentIndex];
  const next   = displayVenues[currentIndex + 1];
  const energy = ENERGY_CONFIG[venue?.energy_level] ?? ENERGY_CONFIG['quiet'];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: bgOpac }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>QUICK RATE</Text>
            <Text style={styles.headerSub}>Swipe right to fire  ·  left to skip</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color="#555" />
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {displayVenues.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < currentIndex  && styles.progressDotDone,
                i === currentIndex && !done && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {/* Card area */}
        {done ? (
          <View style={styles.doneBlock}>
            <Text style={styles.doneEmoji}>{fireCount > 0 ? '🔥' : '👀'}</Text>
            <Text style={styles.doneTitle}>
              {fireCount > 0
                ? `${fireCount} spot${fireCount > 1 ? 's' : ''} fired`
                : 'Nothing caught your eye'}
            </Text>
            <Text style={styles.doneSub}>
              {fireCount > 0
                ? 'Your signals are live. The scene reads you.'
                : 'New spots rolling in — check back later.'}
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={dismiss} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : venue ? (
          <View style={styles.cardArea}>
            {/* Next card behind */}
            {next && (
              <View style={[styles.card, styles.cardBehind]}>
                <LinearGradient colors={['#111120', '#0A0A16']} style={styles.cardGrad}>
                  <Text style={styles.behindName} numberOfLines={1}>{next.name}</Text>
                  <Text style={styles.behindArea}>{next.area}</Text>
                </LinearGradient>
              </View>
            )}

            {/* Active card */}
            <Animated.View
              style={[styles.card, {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ],
              }]}
              {...panResponder.panHandlers}
            >
              <LinearGradient colors={['#151526', '#0D0D1C', '#080812']} style={styles.cardGrad}>

                {/* FIRE label */}
                <Animated.View style={[styles.swiperLabel, styles.swiperFire, { opacity: fireOpacity }]}>
                  <Text style={styles.swiperFireText}>🔥 FIRE</Text>
                </Animated.View>

                {/* SKIP label */}
                <Animated.View style={[styles.swiperLabel, styles.swiperSkip, { opacity: skipOpacity }]}>
                  <Text style={styles.swiperSkipText}>SKIP</Text>
                </Animated.View>

                {/* Energy accent bar */}
                <View style={[styles.energyBar, { backgroundColor: energy.color }]} />

                <View style={styles.cardContent}>
                  {/* Energy pill */}
                  <View style={[styles.energyPill, { backgroundColor: energy.color + '1A', borderColor: energy.color + '40' }]}>
                    <Text style={[styles.energyPillText, { color: energy.color }]}>{energy.label}</Text>
                  </View>

                  {/* Name */}
                  <Text style={styles.venueName} numberOfLines={2}>{venue.name}</Text>
                  {venue.area && <Text style={styles.venueArea}>{venue.area}</Text>}

                  {/* Score bar */}
                  <View style={styles.scoreRow}>
                    <View style={styles.scoreTrack}>
                      <View style={[styles.scoreFill, { width: `${venue.current_vibe_score}%` as any, backgroundColor: energy.color }]} />
                    </View>
                    <Text style={[styles.scoreNum, { color: energy.color }]}>{venue.current_vibe_score}</Text>
                  </View>

                  {/* Chips */}
                  <View style={styles.chipsRow}>
                    {venue.capacity_level && (
                      <View style={styles.chip}>
                        <Ionicons name="people" size={10} color="#555" />
                        <Text style={styles.chipText}>
                          {venue.capacity_level === 'full' ? 'Packed' : venue.capacity_level === 'vibrant' ? 'Vibrant' : 'Light'}
                        </Text>
                      </View>
                    )}
                    {venue.music_genre && (
                      <View style={styles.chip}>
                        <Ionicons name="musical-notes" size={10} color="#555" />
                        <Text style={styles.chipText}>{venue.music_genre}</Text>
                      </View>
                    )}
                    {venue.entry_fee && (
                      <View style={styles.chip}>
                        <Ionicons name="ticket" size={10} color="#555" />
                        <Text style={styles.chipText}>{venue.entry_fee}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Swipe hint */}
                <Text style={styles.swipeHint}>← skip  ·  fire →</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        ) : null}

        {/* Action buttons */}
        {!done && venue && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionSkip]} onPress={swipeSkip} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color="#444" />
            </TouchableOpacity>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{currentIndex + 1} / {displayVenues.length}</Text>
            </View>
            <TouchableOpacity style={[styles.actionBtn, styles.actionFire]} onPress={swipeFire} activeOpacity={0.8}>
              <Ionicons name="flame" size={26} color="#FF3366" />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const CARD_H = H * 0.42;

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.88)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: H * 0.84, backgroundColor: '#07070F',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  handle:      { width: 40, height: 4, backgroundColor: '#1C1C2C', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  headerTitle: { fontSize: 11, fontWeight: '900', color: '#EEE', letterSpacing: 2 },
  headerSub:   { fontSize: 11, color: '#3A3A4E', marginTop: 3 },
  closeBtn:    { padding: 4 },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 14 },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#111120' },
  progressDotDone:   { backgroundColor: '#FF336633' },
  progressDotActive: { backgroundColor: '#FF3366' },

  cardArea:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    width: W - 28, height: CARD_H,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1C1C2E',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  cardBehind:  { transform: [{ scale: 0.94 }, { translateY: 14 }], opacity: 0.55, zIndex: 0 },
  cardGrad:    { flex: 1 },
  energyBar:   { height: 3 },
  cardContent: { flex: 1, paddingHorizontal: 22, paddingTop: 18, justifyContent: 'center' },
  energyPill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14,
  },
  energyPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  venueName:   { fontSize: 30, fontWeight: '900', color: '#FFF', letterSpacing: -0.5, lineHeight: 34, marginBottom: 6 },
  venueArea:   { fontSize: 13, color: '#444', fontWeight: '500', marginBottom: 18 },
  scoreRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  scoreTrack:  { flex: 1, height: 3, backgroundColor: '#111120', borderRadius: 2 },
  scoreFill:   { height: 3, borderRadius: 2 },
  scoreNum:    { fontSize: 13, fontWeight: '900', width: 28, textAlign: 'right' },
  chipsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#0E0E1C', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  chipText:    { color: '#555', fontSize: 10, fontWeight: '600' },
  swipeHint:   { textAlign: 'center', color: '#1C1C2C', fontSize: 10, fontWeight: '600', letterSpacing: 1, paddingBottom: 14 },
  swiperLabel: { position: 'absolute', zIndex: 20, top: 18, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 2, borderRadius: 10 },
  swiperFire:  { right: 18, borderColor: '#FF336666', backgroundColor: '#FF336612', transform: [{ rotate: '10deg' }] },
  swiperSkip:  { left: 18, borderColor: '#44444466', backgroundColor: '#11111222', transform: [{ rotate: '-10deg' }] },
  swiperFireText: { fontSize: 16, fontWeight: '900', color: '#FF3366' },
  swiperSkipText: { fontSize: 14, fontWeight: '900', color: '#444' },

  actionRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, paddingBottom: 36, paddingTop: 4 },
  actionBtn: {
    width: 62, height: 62, borderRadius: 31,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  actionSkip:  { backgroundColor: '#0C0C18', borderColor: '#1A1A28' },
  actionFire:  { backgroundColor: '#FF336614', borderColor: '#FF336640' },
  countPill:   { backgroundColor: '#0D0D1A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  countText:   { color: '#2A2A4A', fontSize: 11, fontWeight: '700' },

  doneBlock:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44, gap: 14 },
  doneEmoji:   { fontSize: 56 },
  doneTitle:   { fontSize: 24, fontWeight: '900', color: '#EEE', textAlign: 'center' },
  doneSub:     { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 22 },
  doneBtn: {
    marginTop: 10, backgroundColor: '#FF336614', borderWidth: 1,
    borderColor: '#FF336640', borderRadius: 14,
    paddingHorizontal: 36, paddingVertical: 14,
  },
  doneBtnText: { color: '#FF3366', fontSize: 14, fontWeight: '800' },
  behindName:  { color: '#2A2A3E', fontSize: 18, fontWeight: '800', paddingHorizontal: 22, paddingTop: 22 },
  behindArea:  { color: '#1C1C2C', fontSize: 12, fontWeight: '600', paddingHorizontal: 22, marginTop: 4 },
});
