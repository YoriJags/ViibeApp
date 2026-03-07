/**
 * VenueSpotlight — full-screen theater mode for a venue.
 * Opens from venue card tap. Swipe-up reveal, full-bleed image.
 * "This venue deserves more than a card."
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal,
  StyleSheet, Dimensions, Image, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');

const CLUB_IMAGES = [
  'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
  'https://images.unsplash.com/photo-1571266028243-d220c8b77883?w=800&q=80',
  'https://images.unsplash.com/photo-1508997449629-303059a039c0?w=800&q=80',
  'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=800&q=80',
];

const ENERGY_CONFIG: Record<string, { label: string; color: string }> = {
  peak:    { label: 'PEAK',    color: '#FF3366' },
  lit:     { label: 'LIT',     color: '#FF8C00' },
  charged: { label: 'CHARGED', color: '#9933FF' },
  warming: { label: 'WARMING', color: '#6655FF' },
  chill:   { label: 'CHILL',   color: '#3399FF' },
  quiet:   { label: 'QUIET',   color: '#3A3A4E' },
};

const CAPACITY_LABELS: Record<string, string> = {
  sparse: 'Light crowd', vibrant: 'Vibrant', full: 'Packed',
};

const GATE_LABELS: Record<string, { label: string; icon: string }> = {
  clear: { label: 'No wait', icon: 'checkmark-circle' },
  slow:  { label: 'Short wait', icon: 'time' },
  blocked: { label: 'Long queue', icon: 'alert-circle' },
};

interface Venue {
  id: string;
  name: string;
  address?: string;
  area?: string;
  current_vibe_score: number;
  energy_level: string;
  capacity_level?: string;
  gate_level?: string;
  entry_fee?: string;
  music_genre?: string;
  viibe_certified?: boolean;
}

interface Props {
  visible: boolean;
  venue: Venue | null;
  onClose: () => void;
}

export default function VenueSpotlight({ visible, venue, onClose }: Props) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(H)).current;
  const bgOpac   = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(40)).current;

  // Swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideAnim.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 14, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: H, duration: 300, useNativeDriver: true }),
      Animated.timing(bgOpac,    { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onClose);
  };

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(H);
      contentY.setValue(40);
      bgOpac.setValue(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 14, useNativeDriver: true }),
        Animated.timing(bgOpac, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(contentY, { toValue: 0, tension: 55, friction: 12, delay: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!venue) return null;

  const imgUrl = CLUB_IMAGES[Math.abs(venue.id.charCodeAt(0) + venue.id.charCodeAt(venue.id.length - 1)) % CLUB_IMAGES.length];
  const energy  = ENERGY_CONFIG[venue.energy_level] ?? ENERGY_CONFIG['quiet'];
  const score   = venue.current_vibe_score;
  const gateInfo = GATE_LABELS[venue.gate_level ?? 'clear'];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      {/* Dim background — tap to close */}
      <Animated.View style={[styles.backdrop, { opacity: bgOpac }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      {/* Slide-up sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        {...panResponder.panHandlers}
      >
        {/* Swipe handle */}
        <View style={styles.handle} />

        {/* Hero image */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: imgUrl }} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', '#080810']}
            style={StyleSheet.absoluteFill}
          />

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color="#FFF" />
          </TouchableOpacity>

          {/* Energy badge */}
          <View style={[styles.energyBadge, { backgroundColor: energy.color }]}>
            <Text style={styles.energyText}>{energy.label}</Text>
          </View>

          {/* Certified badge */}
          {venue.viibe_certified && (
            <View style={styles.certBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#FFD700" />
              <Text style={styles.certText}>VIIBE Certified</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <Animated.View style={[styles.content, { transform: [{ translateY: contentY }] }]}>

          {/* Venue name */}
          <Text style={styles.venueName} numberOfLines={2}>{venue.name}</Text>
          {venue.area && <Text style={styles.venueArea}>{venue.area}</Text>}

          {/* Vibe score bar */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreBarTrack}>
              <View style={[styles.scoreBarFill, {
                width: `${score}%`,
                backgroundColor: energy.color,
              }]} />
            </View>
            <Text style={[styles.scoreNum, { color: energy.color }]}>{score}</Text>
          </View>

          {/* Quick chips */}
          <View style={styles.chipsRow}>
            {venue.capacity_level && (
              <View style={styles.chip}>
                <Ionicons name="people" size={11} color="#888" />
                <Text style={styles.chipText}>{CAPACITY_LABELS[venue.capacity_level] ?? venue.capacity_level}</Text>
              </View>
            )}
            {venue.gate_level && (
              <View style={styles.chip}>
                <Ionicons name={gateInfo.icon as any} size={11} color="#888" />
                <Text style={styles.chipText}>{gateInfo.label}</Text>
              </View>
            )}
            {venue.entry_fee && (
              <View style={styles.chip}>
                <Ionicons name="ticket" size={11} color="#888" />
                <Text style={styles.chipText}>{venue.entry_fee}</Text>
              </View>
            )}
            {venue.music_genre && (
              <View style={styles.chip}>
                <Ionicons name="musical-notes" size={11} color="#888" />
                <Text style={styles.chipText}>{venue.music_genre}</Text>
              </View>
            )}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.detailsBtn, { borderColor: energy.color + '66' }]}
            onPress={() => {
              dismiss();
              setTimeout(() => router.push(`/venue/${venue.id}`), 320);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.detailsBtnText, { color: energy.color }]}>View Full Details</Text>
            <Ionicons name="arrow-forward" size={15} color={energy.color} />
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const SHEET_H = H * 0.72;
const HERO_H  = SHEET_H * 0.48;

const styles = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet:         {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_H, backgroundColor: '#080810',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
  },
  handle:        {
    width: 40, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 0,
  },
  heroWrap:      { width: W, height: HERO_H, position: 'relative' },
  heroImage:     { width: '100%', height: '100%' },
  closeBtn:      {
    position: 'absolute', top: 12, right: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
  },
  energyBadge:   {
    position: 'absolute', top: 12, left: 14,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  energyText:    { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  certBadge:     {
    position: 'absolute', top: 42, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  certText:      { color: '#FFD700', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  content:       { paddingHorizontal: 20, paddingTop: 16, flex: 1 },
  venueName:     { color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, lineHeight: 30 },
  venueArea:     { color: '#555', fontSize: 13, fontWeight: '500', marginTop: 3, marginBottom: 10 },
  scoreRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  scoreBarTrack: { flex: 1, height: 3, backgroundColor: '#1A1A2A', borderRadius: 2 },
  scoreBarFill:  { height: 3, borderRadius: 2 },
  scoreNum:      { fontSize: 13, fontWeight: '900', width: 28, textAlign: 'right' },
  chipsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 },
  chip:          {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#111120', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  chipText:      { color: '#777', fontSize: 11, fontWeight: '600' },
  detailsBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, paddingVertical: 14,
    backgroundColor: '#0E0E1C',
  },
  detailsBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
