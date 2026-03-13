/**
 * VibePassport — Scout identity card.
 *
 * Your permanent record in the Lagos nightlife scene.
 * Shows: avatar, handle, persona, heat level, streak,
 * hot nights, total taps, total ratings, top venue.
 *
 * "This is you. Unfakeable."
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal,
  StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import AvatarDisplay from './AvatarDisplay';

const { width: W, height: H } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const PERSONA_LABELS: Record<string, string> = {
  turn_up:    'Turn Up',
  grown_sexy: 'The Luxe',
  culture:    'Culture',
  chill_set:  'Chill Set',
};
const PERSONA_COLORS: Record<string, string> = {
  turn_up:    '#FF3366',
  grown_sexy: '#FFD700',
  culture:    '#00E676',
  chill_set:  '#3399FF',
};
const HEAT_COLORS: Record<string, string> = {
  cold:    '#3A3A4E',
  warming: '#6655FF',
  hot:     '#FF9933',
  on_fire: '#FF3366',
};

interface PassportData {
  heat_level: string;
  heat_label: string;
  heat_score: number;
  hot_nights: number;
  streak_days: number;
  total_taps: number;
  top_venue_name: string | null;
  total_ratings: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  isDemoMode?: boolean;
}

const DEMO_PASSPORT: PassportData = {
  heat_level: 'hot',
  heat_label: 'Hot',
  heat_score: 14,
  hot_nights: 12,
  streak_days: 4,
  total_taps: 312,
  top_venue_name: 'DNA Nightclub',
  total_ratings: 38,
};

export default function VibePassport({ visible, onClose, isDemoMode }: Props) {
  const user           = useVibeStore(s => s.user);
  const avatarConfig   = useVibeStore(s => s.avatarConfig);
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [data, setData] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(H)).current;
  const bgOpac    = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    slideAnim.setValue(H);
    bgOpac.setValue(0);
    scaleAnim.setValue(0.92);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 14, useNativeDriver: true }),
      Animated.timing(bgOpac,    { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 12, delay: 100, useNativeDriver: true }),
    ]).start();
    loadPassport();
  }, [visible]);

  const loadPassport = async () => {
    if (isDemoMode) { setData(DEMO_PASSPORT); return; }
    setLoading(true);
    try {
      const [auraRes, tapRes] = await Promise.all([
        fetch(`${API_URL}/api/me/aura`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/me/tap-history`, { headers: getAuthHeaders() }),
      ]);
      const aura = auraRes.ok ? await auraRes.json() : null;
      const tap  = tapRes.ok  ? await tapRes.json()  : null;
      if (aura && tap) {
        setData({
          heat_level:     aura.heat_level,
          heat_label:     aura.heat_label,
          heat_score:     aura.heat_score,
          hot_nights:     aura.hot_nights,
          streak_days:    aura.streak_days,
          total_taps:     tap.all_time.total_taps,
          top_venue_name: tap.all_time.top_venue?.venue_name ?? null,
          total_ratings:  user?.total_ratings ?? 0,
        });
      }
    } catch {}
    setLoading(false);
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: H, duration: 280, useNativeDriver: true }),
      Animated.timing(bgOpac,    { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  if (!user) return null;

  const persona      = (user as any).persona ?? (user as any).vibePersona ?? 'turn_up';
  const personaLabel = PERSONA_LABELS[persona] ?? persona;
  const personaColor = PERSONA_COLORS[persona] ?? '#6655FF';
  const heatColor    = data ? (HEAT_COLORS[data.heat_level] ?? '#6655FF') : '#6655FF';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: bgOpac }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Pull handle */}
        <View style={styles.handle} />

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color="#555" />
        </TouchableOpacity>

        <Animated.View style={[styles.inner, { transform: [{ scale: scaleAnim }] }]}>
          {/* Passport card */}
          <LinearGradient
            colors={['#0E0E1C', '#131325', '#0C0C15']}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Top accent bar */}
            <View style={[styles.accentBar, { backgroundColor: personaColor }]} />

            {/* Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.passportTitle}>SCOUT PASSPORT</Text>
              <Text style={styles.passportSub}>VIIBE · NIGERIA</Text>
            </View>

            {/* Avatar + identity */}
            <View style={styles.identityRow}>
              <AvatarDisplay config={avatarConfig} username={user.username} size={72} />
              <View style={styles.identityInfo}>
                <Text style={styles.username}>@{user.username}</Text>
                {user.display_name && (
                  <Text style={styles.displayName}>{user.display_name}</Text>
                )}
                <View style={[styles.personaBadge, { borderColor: personaColor + '60', backgroundColor: personaColor + '18' }]}>
                  <Text style={[styles.personaText, { color: personaColor }]}>{personaLabel}</Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {loading ? (
              <ActivityIndicator color="#6655FF" size="small" style={{ marginVertical: 24 }} />
            ) : data ? (
              <>
                {/* Heat stat */}
                <View style={styles.heatRow}>
                  <View style={[styles.heatBadge, { borderColor: heatColor + '55', backgroundColor: heatColor + '15' }]}>
                    <Text style={[styles.heatLabel, { color: heatColor }]}>{data.heat_label.toUpperCase()}</Text>
                    <Text style={[styles.heatScore, { color: heatColor }]}>{data.heat_score} pts tonight</Text>
                  </View>
                  <View style={styles.heatMeta}>
                    <Text style={styles.hotNightsNum}>{data.hot_nights}</Text>
                    <Text style={styles.hotNightsLabel}>Hot Nights</Text>
                  </View>
                </View>

                {/* Stats grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statCell}>
                    <Text style={styles.statNum}>{data.total_taps.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Total Taps</Text>
                  </View>
                  <View style={[styles.statCell, styles.statCellBorder]}>
                    <Text style={styles.statNum}>{data.total_ratings}</Text>
                    <Text style={styles.statLabel}>Ratings</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statNum}>{data.streak_days}</Text>
                    <Text style={styles.statLabel}>Day Streak</Text>
                  </View>
                </View>

                {/* Top venue */}
                {data.top_venue_name && (
                  <View style={styles.topVenueRow}>
                    <Ionicons name="trophy" size={12} color="#FFD700" />
                    <Text style={styles.topVenueLabel}>Top Venue</Text>
                    <Text style={styles.topVenueName} numberOfLines={1}>{data.top_venue_name}</Text>
                  </View>
                )}
              </>
            ) : null}

            {/* Footer stamp */}
            <View style={styles.stampRow}>
              <Text style={styles.stampText}>VERIFIED SCOUT · LAGOS</Text>
              <Ionicons name="flash" size={11} color="#2A2A4A" />
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const CARD_W = W - 48;

const styles = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#08080F',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, paddingTop: 12,
    alignItems: 'center',
  },
  handle:       { width: 40, height: 4, backgroundColor: '#222', borderRadius: 2, marginBottom: 20 },
  closeBtn:     { position: 'absolute', top: 16, right: 20, padding: 6 },
  inner:        { width: CARD_W },
  card: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: '#1C1C2C',
  },
  accentBar:    { height: 4, width: '100%' },
  cardHeader:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  passportTitle: { fontSize: 10, color: '#3A3A4E', fontWeight: '800', letterSpacing: 2 },
  passportSub:   { fontSize: 9, color: '#2A2A4A', fontWeight: '600', letterSpacing: 1 },
  identityRow:  { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingBottom: 16 },
  identityInfo: { flex: 1, gap: 4 },
  username:     { fontSize: 20, fontWeight: '900', color: '#EEE', letterSpacing: -0.3 },
  displayName:  { fontSize: 13, color: '#666', fontWeight: '500' },
  personaBadge: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  personaText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  divider:      { height: 1, backgroundColor: '#111120', marginHorizontal: 20, marginBottom: 16 },
  heatRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  heatBadge:    { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  heatLabel:    { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  heatScore:    { fontSize: 11, fontWeight: '500', marginTop: 2 },
  heatMeta:     { alignItems: 'center' },
  hotNightsNum:  { fontSize: 28, fontWeight: '900', color: '#EEE', lineHeight: 30 },
  hotNightsLabel: { fontSize: 8, color: '#444', fontWeight: '600', letterSpacing: 0.5 },
  statsGrid:    { flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, backgroundColor: '#0E0E1C', borderRadius: 12, overflow: 'hidden' },
  statCell:     { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#111120' },
  statNum:      { fontSize: 20, fontWeight: '900', color: '#DDD' },
  statLabel:    { fontSize: 9, color: '#3A3A4E', fontWeight: '600', marginTop: 2 },
  topVenueRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 14 },
  topVenueLabel: { fontSize: 10, color: '#666', fontWeight: '600' },
  topVenueName:  { fontSize: 12, color: '#FFD700', fontWeight: '700', flex: 1 },
  stampRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 10, borderTopWidth: 1, borderColor: '#0E0E1C' },
  stampText:    { fontSize: 8, color: '#1A1A2E', fontWeight: '700', letterSpacing: 2 },
});
