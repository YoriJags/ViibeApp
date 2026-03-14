/**
 * AfterHours — Your night, debriefed.
 *
 * Opens as a full-screen modal after the night winds down.
 * Shows: heat level reached, checkins, ratings, bolts dropped,
 * top venue, streak, "hot night" confirmation.
 *
 * Triggered from profile or manually from the home screen.
 * "You showed up. Here's what you did."
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal,
  StyleSheet, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import VibeShareCard, { ShareNightData } from './VibeShareCard';

const { width: W, height: H } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface NightRecap {
  checkins_tonight: number;
  ratings_tonight: number;
  bolts_tonight: number;
  venues_visited: { id: string; name: string }[];
  top_venue: {
    venue_name: string;
    venue_area: string;
    energy_level: string;
    tap_count: number;
  } | null;
  heat_score: number;
  heat_level: string;
  heat_label: string;
  heat_color: string;
  streak_days: number;
  hot_nights: number;
  is_hot_night: boolean;
}

const DEMO_RECAP: NightRecap = {
  checkins_tonight: 2,
  ratings_tonight: 3,
  bolts_tonight: 17,
  venues_visited: [
    { id: '1', name: 'DNA Nightclub' },
    { id: '2', name: 'Club Quilox' },
  ],
  top_venue: {
    venue_name: 'DNA Nightclub',
    venue_area: 'Victoria Island',
    energy_level: 'peak',
    tap_count: 9,
  },
  heat_score: 39,
  heat_level: 'on_fire',
  heat_label: 'On Fire',
  heat_color: '#FF3366',
  streak_days: 4,
  hot_nights: 12,
  is_hot_night: true,
};

interface Props {
  visible: boolean;
  onClose: () => void;
  isDemoMode?: boolean;
}

export default function AfterHours({ visible, onClose, isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const user           = useVibeStore(s => s.user);
  const cityPulse      = useVibeStore(s => s.cityPulse);
  const vibeDNA        = useVibeStore(s => s.vibeDNA);
  const [recap, setRecap] = useState<NightRecap | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  const slideAnim  = useRef(new Animated.Value(H)).current;
  const bgOpac     = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(30)).current;
  const glowAnim   = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    slideAnim.setValue(H);
    bgOpac.setValue(0);
    contentAnim.setValue(30);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 14, useNativeDriver: true }),
      Animated.timing(bgOpac,    { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(contentAnim, { toValue: 0, tension: 50, friction: 12, delay: 200, useNativeDriver: true }),
    ]).start();
    loadRecap();
  }, [visible]);

  useEffect(() => {
    if (recap?.heat_level === 'on_fire') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 700, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 700, useNativeDriver: false }),
      ])).start();
    }
  }, [recap?.heat_level]);

  const loadRecap = async () => {
    if (isDemoMode) { setRecap(DEMO_RECAP); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/me/night-recap`, { headers: getAuthHeaders() });
      if (res.ok) setRecap(await res.json());
    } catch {}
    setLoading(false);
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: H, duration: 300, useNativeDriver: true }),
      Animated.timing(bgOpac,    { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onClose);
  };

  const color = recap?.heat_color ?? '#6655FF';
  const isOnFire = recap?.heat_level === 'on_fire';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: bgOpac }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color="#555" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={color} />
              <Text style={styles.loadingText}>Compiling your night...</Text>
            </View>
          ) : recap ? (
            <Animated.View style={[styles.content, { transform: [{ translateY: contentAnim }] }]}>

              {/* Title */}
              <Text style={styles.title}>AFTERHOURS</Text>

              {/* Heat banner */}
              <LinearGradient
                colors={[color + '28', color + '10', 'transparent']}
                style={[styles.heatBanner, { borderColor: color + '44' }]}
              >
                <View style={styles.heatBannerInner}>
                  <View>
                    <Text style={styles.heatBannerLabel}>HEAT LEVEL REACHED</Text>
                    <Animated.Text style={[styles.heatBannerLevel, { color, opacity: isOnFire ? glowAnim : 1 }]}>
                      {recap.heat_label.toUpperCase()}
                    </Animated.Text>
                    <Text style={[styles.heatScore, { color }]}>{recap.heat_score} pts</Text>
                  </View>
                  <View style={styles.hotNightsBlock}>
                    <Text style={[styles.hotNightsNum, { color }]}>{recap.hot_nights}</Text>
                    <Text style={styles.hotNightsLabel}>Hot{'\n'}Nights</Text>
                  </View>
                </View>
                {recap.is_hot_night && (
                  <View style={[styles.hotNightStamp, { borderColor: color + '55', backgroundColor: color + '18' }]}>
                    <Ionicons name="flame" size={11} color={color} />
                    <Text style={[styles.hotNightStampText, { color }]}>HOT NIGHT EARNED</Text>
                  </View>
                )}
              </LinearGradient>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <Ionicons name="location" size={18} color={color} />
                  <Text style={styles.statNum}>{recap.checkins_tonight}</Text>
                  <Text style={styles.statLabel}>Check-ins</Text>
                </View>
                <View style={styles.statCell}>
                  <Ionicons name="star" size={18} color={color} />
                  <Text style={styles.statNum}>{recap.ratings_tonight}</Text>
                  <Text style={styles.statLabel}>Ratings</Text>
                </View>
                <View style={styles.statCell}>
                  <Ionicons name="flash" size={18} color={color} />
                  <Text style={styles.statNum}>{recap.bolts_tonight}</Text>
                  <Text style={styles.statLabel}>Bolts</Text>
                </View>
                <View style={styles.statCell}>
                  <Ionicons name="flame" size={18} color="#FF6633" />
                  <Text style={styles.statNum}>{recap.streak_days}</Text>
                  <Text style={styles.statLabel}>Streak</Text>
                </View>
              </View>

              {/* Venues hit tonight */}
              {recap.venues_visited.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SPOTS HIT TONIGHT</Text>
                  <View style={styles.venueList}>
                    {recap.venues_visited.map((v, i) => (
                      <View key={v.id} style={styles.venueItem}>
                        <Text style={styles.venueItemNum}>{i + 1}</Text>
                        <Text style={styles.venueItemName}>{v.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Top venue */}
              {recap.top_venue && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>WHERE YOU LEFT YOUR MARK</Text>
                  <View style={[styles.topVenueCard, { borderColor: color + '44', backgroundColor: color + '0E' }]}>
                    <Ionicons name="flash" size={16} color={color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.topVenueName, { color }]}>{recap.top_venue.venue_name}</Text>
                      <Text style={styles.topVenueArea}>{recap.top_venue.venue_area}</Text>
                    </View>
                    <View style={styles.topVenueTaps}>
                      <Text style={[styles.topVenueTapNum, { color }]}>{recap.top_venue.tap_count}</Text>
                      <Text style={styles.topVenueTapLabel}>bolts</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Closing line */}
              <Text style={styles.closingLine}>
                {recap.heat_level === 'on_fire'
                  ? 'The scene felt you tonight.'
                  : recap.heat_level === 'hot'
                  ? 'You moved the scene tonight.'
                  : recap.heat_level === 'warming'
                  ? 'You showed up. That matters.'
                  : 'New night tomorrow.'}
              </Text>

              {/* Share your night */}
              <TouchableOpacity
                style={[styles.shareBtn, { borderColor: color + '55', backgroundColor: color + '14' }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowShareCard(true);
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="share-outline" size={15} color={color} />
                <Text style={[styles.shareBtnText, { color }]}>SHARE YOUR NIGHT</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </ScrollView>
      </Animated.View>
      {/* Vibe Share Card — export your night as a shareable image */}
      {recap && (
        <VibeShareCard
          visible={showShareCard}
          onClose={() => setShowShareCard(false)}
          data={{
            username:        user?.username ?? user?.name ?? 'Scout',
            scoutStatus:     user?.scout_status ?? undefined,
            rank:            (user as any)?.rank ?? undefined,
            auraLabel:       recap.heat_label,
            auraColor:       recap.heat_color,
            heatScore:       recap.heat_score,
            boltsTonight:    recap.bolts_tonight,
            checkinsTonight: recap.checkins_tonight,
            ratingsTonight:  recap.ratings_tonight,
            streakDays:      recap.streak_days,
            hotNights:       recap.hot_nights,
            topVenueName:    recap.top_venue?.venue_name,
            dnaSignature:    cityPulse?.city_vibe_signature ?? (vibeDNA as any)?.dominant_type,
            sparkline:       cityPulse?.sparkline ?? [40, 55, 60, 70, 75, 78],
            city:            cityPulse?.city ?? 'Lagos',
            date:            new Date().toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
            isDemoMode,
          }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: H * 0.88,
    backgroundColor: '#080810',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handle:       { width: 40, height: 4, backgroundColor: '#1A1A2E', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  closeBtn:     { position: 'absolute', top: 14, right: 18, padding: 6, zIndex: 10 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 20 },
  loadingBlock: { alignItems: 'center', gap: 12, paddingTop: 60 },
  loadingText:  { color: '#555', fontSize: 13 },
  content:      { gap: 16 },
  title: { fontSize: 10, color: '#2A2A4A', fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginBottom: 4 },
  heatBanner:   { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  heatBannerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heatBannerLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  heatBannerLevel: { fontSize: 32, fontWeight: '900', letterSpacing: 1, lineHeight: 34 },
  heatScore:    { fontSize: 12, fontWeight: '600', marginTop: 2 },
  hotNightsBlock: { alignItems: 'center' },
  hotNightsNum: { fontSize: 42, fontWeight: '900', lineHeight: 44 },
  hotNightsLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  hotNightStamp: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  hotNightStampText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statsRow:     { flexDirection: 'row', backgroundColor: '#0C0C18', borderRadius: 16, overflow: 'hidden' },
  statCell:     { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statNum:      { fontSize: 20, fontWeight: '900', color: '#EEE' },
  statLabel:    { fontSize: 9, color: '#3A3A4E', fontWeight: '600' },
  section:      { gap: 8 },
  sectionLabel: { fontSize: 8, color: '#2A2A4A', fontWeight: '800', letterSpacing: 2 },
  venueList:    { gap: 6 },
  venueItem:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  venueItemNum: { fontSize: 11, color: '#3A3A4E', fontWeight: '700', width: 18 },
  venueItemName: { fontSize: 13, color: '#CCC', fontWeight: '600' },
  topVenueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 14, padding: 14,
  },
  topVenueName: { fontSize: 16, fontWeight: '900' },
  topVenueArea: { fontSize: 11, color: '#555', fontWeight: '500', marginTop: 1 },
  topVenueTaps: { alignItems: 'center' },
  topVenueTapNum: { fontSize: 24, fontWeight: '900', lineHeight: 26 },
  topVenueTapLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '600' },
  closingLine:  { fontSize: 14, color: '#555', fontWeight: '600', textAlign: 'center', fontStyle: 'italic', paddingVertical: 8 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderRadius: 14,
    paddingVertical: 12, marginTop: 4,
  },
  shareBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
