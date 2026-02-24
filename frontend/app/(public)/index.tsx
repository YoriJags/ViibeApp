import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../../src/store/vibeStore';
import { MockMap } from '../../src/components/MockMap';
import { VenueCard } from '../../src/components/VenueCard';
import CloutReward from '../../src/components/CloutReward';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import { PulseRing } from '../../src/components/PulseRing';
import { neonGlow } from '../../src/theme';
import DemoModeBanner from '../../src/components/DemoModeBanner';
import FloorSwitcher from '../../src/components/FloorSwitcher';
import RatePromptFAB from '../../src/components/RatePromptFAB';
import VenueCategoryFilter, { VenueCategory } from '../../src/components/VenueCategoryFilter';
import ElectricTransition from '../../src/components/ElectricTransition';
import TonightHero from '../../src/components/TonightHero';
import CartelPulse from '../../src/components/CartelPulse';
import { DEMO_ACTIVITY_FEED, DEMO_TONIGHT, DEMO_VIBE_MATCH, DEMO_VENUES } from '../../src/data/demoData';
import VibeMatch from '../../src/components/VibeMatch';
import NightPlannerModal from '../../src/components/NightPlannerModal';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import TheWave from '../../src/components/TheWave';
import VibeMarket, { VibeMarketVenue } from '../../src/components/VibeMarket';
import NoDulling from '../../src/components/NoDulling';
import ActivityTicker from '../../src/components/ActivityTicker';
import { getNightPhase } from '../../src/store/vibeStore';
import { calculateDistance } from '../../src/utils/geo';
import VibeBriefCard from '../../src/components/VibeBriefCard';

const { width } = Dimensions.get('window');

// ─── City Welcome Card ────────────────────────────────────────────────────────
// Shown to new users (no check-in, no persona) as the first impression hook.
// City energy score + live stats + invite into the night.

interface CityWelcomeProps {
  cityPulse: { pulse_score: number; pulse_label: string; active_scouts: number; live_venues: number } | null;
  cityName: string;
  onPlannerPress: () => void;
}

function CityWelcomeCard({ cityPulse, cityName, onPlannerPress }: CityWelcomeProps) {
  const score = cityPulse?.pulse_score ?? 42;
  const label = (cityPulse?.pulse_label ?? 'BUZZING').toUpperCase();
  const scouts = cityPulse?.active_scouts ?? 0;
  const liveSpots = cityPulse?.live_venues ?? 0;

  const color =
    score >= 80 ? '#FF3366' :
    score >= 60 ? '#FF9933' :
    score >= 30 ? '#9933FF' :
    '#3399FF';

  const headline =
    label === 'ELECTRIC' ? `🔥 ${cityName} is going absolutely OFF` :
    label === 'POPPING'  ? `🎉 ${cityName} is popping right now` :
    label === 'BUZZING'  ? `✨ The ${cityName} scene is building` :
    `🌙 ${cityName} is quiet — early spots available`;

  const subline =
    label === 'ELECTRIC' ? 'Don\'t sleep — the best spots are filling fast' :
    label === 'POPPING'  ? 'Good timing. Pick your spot before it maxes out' :
    label === 'BUZZING'  ? 'Night is young. Get in early, earn more clout' :
    'Quiet night — ideal to explore without the queue';

  return (
    <View style={wcStyles.wrap}>
      <LinearGradient
        colors={[color + '22', '#0A0A0F']}
        style={[wcStyles.card, { borderColor: color + '35' }]}
      >
        {/* Energy badge */}
        <View style={[wcStyles.energyBadge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
          <View style={[wcStyles.energyDot, { backgroundColor: color }]} />
          <Text style={[wcStyles.energyLabel, { color }]}>{label}</Text>
        </View>

        {/* Headline */}
        <Text style={wcStyles.headline}>{headline}</Text>
        <Text style={wcStyles.subline}>{subline}</Text>

        {/* Live stats row */}
        <View style={wcStyles.statsRow}>
          <View style={wcStyles.stat}>
            <Text style={[wcStyles.statNum, { color }]}>
              {liveSpots > 0 ? liveSpots : '10+'}
            </Text>
            <Text style={wcStyles.statLabel}>spots live</Text>
          </View>
          <View style={wcStyles.statDivider} />
          <View style={wcStyles.stat}>
            <Text style={[wcStyles.statNum, { color }]}>
              {scouts > 0 ? scouts : '200+'}
            </Text>
            <Text style={wcStyles.statLabel}>scouts out</Text>
          </View>
          <View style={wcStyles.statDivider} />
          <View style={wcStyles.stat}>
            <Text style={[wcStyles.statNum, { color }]}>{score}%</Text>
            <Text style={wcStyles.statLabel}>city energy</Text>
          </View>
        </View>

        {/* CTA row */}
        <View style={wcStyles.ctaRow}>
          <Text style={wcStyles.ctaHint}>↓ Tonight's top spots below</Text>
          <TouchableOpacity
            style={[wcStyles.plannerBtn, { borderColor: color + '50' }]}
            onPress={onPlannerPress}
            activeOpacity={0.75}
          >
            <Ionicons name="sparkles" size={12} color={color} />
            <Text style={[wcStyles.plannerBtnText, { color }]}>Plan my night</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const wcStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  energyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  energyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  energyLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 26,
    marginBottom: 6,
  },
  subline: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D14',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: '#555',
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#252530',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaHint: {
    fontSize: 12,
    color: '#555',
  },
  plannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  plannerBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ─── Market Teaser ────────────────────────────────────────────────────────────
// Compact top-3 preview on home. Full leaderboard lives on Trending.

function MarketTeaser({
  venues,
  cityLabel,
  onSeeMore,
}: {
  venues: VibeMarketVenue[];
  cityLabel: string;
  onSeeMore: () => void;
}) {
  const top3 = venues.slice(0, 3);
  if (top3.length === 0) return null;

  const badgeColor =
    cityLabel === 'ELECTRIC' ? '#FF3366' :
    cityLabel === 'POPPING'  ? '#FF9933' :
    cityLabel === 'BUZZING'  ? '#9933FF' :
    '#3399FF';

  const scoreColor = (s: number) =>
    s >= 80 ? '#FF3366' : s >= 60 ? '#FF9933' : s >= 40 ? '#9933FF' : '#3399FF';

  return (
    <View style={mtStyles.wrap}>
      {/* Header */}
      <View style={mtStyles.header}>
        <View style={mtStyles.liveRow}>
          <View style={mtStyles.liveDot} />
          <Text style={mtStyles.liveText}>LIVE</Text>
          <Text style={mtStyles.exchangeLabel}>VIBE EXCHANGE</Text>
        </View>
        <View style={[mtStyles.badge, { borderColor: badgeColor + '50' }]}>
          <Text style={[mtStyles.badgeText, { color: badgeColor }]}>{cityLabel}</Text>
        </View>
      </View>

      {/* Top 3 rows */}
      {top3.map((v, i) => (
        <View key={v.id} style={[mtStyles.row, i === 2 && { borderBottomWidth: 0 }]}>
          <Text style={[mtStyles.rank, i === 0 && { color: '#FFD700' }]}>#{i + 1}</Text>
          <Text style={mtStyles.name} numberOfLines={1}>{v.name}</Text>
          <Text style={[mtStyles.score, { color: scoreColor(v.current_vibe_score) }]}>
            {Math.round(v.current_vibe_score)}
          </Text>
        </View>
      ))}

      {/* CTA */}
      <TouchableOpacity style={mtStyles.cta} onPress={onSeeMore} activeOpacity={0.7}>
        <Text style={mtStyles.ctaText}>Full Market</Text>
        <Ionicons name="arrow-forward" size={11} color="#555" />
      </TouchableOpacity>
    </View>
  );
}

const mtStyles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E2A',
    backgroundColor: '#0B0B12',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A24',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#00E676',
  },
  liveText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#00E676',
    letterSpacing: 1.5,
  },
  exchangeLabel: {
    fontSize: 8,
    color: '#333',
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 4,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111118',
  },
  rank: {
    fontSize: 10,
    fontWeight: '800',
    color: '#444',
    width: 22,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#DDD',
  },
  score: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingVertical: 8,
  },
  ctaText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '600',
  },
});

// ─── Weekend Card ─────────────────────────────────────────────────────────────
// Appears Friday 6PM onwards and all of Saturday. Dismissable per session.

function WeekendCard({
  onDismiss,
  pulseScore,
  onExplore,
}: {
  onDismiss: () => void;
  pulseScore: number;
  onExplore: () => void;
}) {
  const day = new Date().getDay(); // 5 = Friday, 6 = Saturday
  const isFriday = day === 5;

  const label    = isFriday ? 'TGIF 🔥' : 'WEEKEND 🎉';
  const headline = isFriday
    ? "It's Friday. No dulling tonight."
    : "Saturday night. Lagos is yours.";
  const subline  = isFriday
    ? "Weekend starts NOW — find your spot before the queues build up."
    : "Peak night. The city is at max energy. Go claim your moment.";

  return (
    <LinearGradient
      colors={['#1C0A22', '#100A18']}
      style={wkStyles.card}
    >
      {/* Dismiss */}
      <TouchableOpacity style={wkStyles.closeBtn} onPress={onDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Ionicons name="close" size={14} color="#444" />
      </TouchableOpacity>

      {/* Label row */}
      <View style={wkStyles.topRow}>
        <LinearGradient
          colors={['#FF3366', '#FF9933']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={wkStyles.labelBadge}
        >
          <Text style={wkStyles.labelText}>{label}</Text>
        </LinearGradient>
        <View style={wkStyles.energyRow}>
          <View style={wkStyles.energyDot} />
          <Text style={wkStyles.energyText}>{pulseScore}% city energy</Text>
        </View>
      </View>

      <Text style={wkStyles.headline}>{headline}</Text>
      <Text style={wkStyles.subline}>{subline}</Text>

      <TouchableOpacity style={wkStyles.cta} onPress={onExplore} activeOpacity={0.75}>
        <Text style={wkStyles.ctaText}>See what's popping</Text>
        <Ionicons name="arrow-forward" size={12} color="#FF9933" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const wkStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FF336622',
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  labelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  energyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9933',
  },
  energyText: {
    fontSize: 10,
    color: '#FF993388',
    fontWeight: '700',
  },
  headline: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subline: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
    marginBottom: 14,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  ctaText: {
    fontSize: 12,
    color: '#FF9933',
    fontWeight: '700',
  },
});

// ─────────────────────────────────────────────────────────────────────────────

// Persona → preferred venue types for feed boosting
const PERSONA_BOOST: Record<string, string[]> = {
  turn_up: ['club', 'bar', 'concert'],
  grown_sexy: ['lounge', 'restaurant'],
  culture: ['concert', 'event', 'block_party'],
  chill_set: ['restaurant', 'lounge', 'cafe'],
};

const CITIES = [
  { code: 'lagos', name: 'Lagos', emoji: '\u{1F3D9}\u{FE0F}', tagline: 'Island & Mainland Scene' },
  { code: 'abuja', name: 'Abuja', emoji: '\u{1F306}', tagline: 'Capital City Scene' },
  { code: 'port_harcourt', name: 'Port Harcourt', emoji: '\u{1F334}', tagline: 'Garden City Scene' },
  { code: 'ibadan', name: 'Ibadan', emoji: '\u{1F3DB}\u{FE0F}', tagline: 'Ancient City Scene' },
];

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ highlightVenue?: string; centerLat?: string; centerLng?: string; showRatedGlow?: string }>();
  const { venues, fetchVenues, loading, error, connectSocket, selectedCity, setSelectedCity, lastRatedVenueId, setLastRatedVenueId, isDemoMode, activeCheckin, crew, vibePersona, vibeDNA, cityPulse, fetchCityPulse, dropQuickPulse, demoPulsedVenues } = useVibeStore();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [showList, setShowList] = useState(true); // List-first: content before map
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showCloutReward, setShowCloutReward] = useState(false);
  const [highlightedVenueId, setHighlightedVenueId] = useState<string | null>(null);
  const [ratedGlowVenueId, setRatedGlowVenueId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VenueCategory>('all');
  const [showTransition, setShowTransition] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [weekendDismissed, setWeekendDismissed] = useState(false);

  // Friday 6PM onwards or all of Saturday
  const isWeekendActive = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const hour = d.getHours();
    return (day === 5 && hour >= 18) || day === 6;
  }, []);

  // Animations
  const headerGlowAnim = useRef(new Animated.Value(0.6)).current;
  const legendElectricPulse = useRef(new Animated.Value(1)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current;

  // Animate header glow
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(headerGlowAnim, { toValue: 0.6, duration: 2000, useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(legendElectricPulse, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(legendElectricPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Auto-switch to list view in demo mode so Tonight journey is visible
  useEffect(() => {
    if (isDemoMode) setShowList(true);
  }, [isDemoMode]);

  // Handle venue highlight from Trending page "Pull Up" button
  useEffect(() => {
    if (params.highlightVenue) {
      setHighlightedVenueId(params.highlightVenue);
      setShowList(false);
      const timer = setTimeout(() => setHighlightedVenueId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [params.highlightVenue]);

  // Handle "rated glow" effect after user submits a rating
  useEffect(() => {
    if (params.showRatedGlow === 'true' && lastRatedVenueId) {
      setRatedGlowVenueId(lastRatedVenueId);
      setShowList(false);
      fetchVenues(selectedCity);
      const timer = setTimeout(() => {
        setRatedGlowVenueId(null);
        setLastRatedVenueId(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [params.showRatedGlow, lastRatedVenueId]);

  useEffect(() => {
    initializeApp();
  }, []);

  // Single source of truth for venue fetching — handles initial load + city changes
  useEffect(() => {
    if (!isDemoMode) {
      fetchVenues(selectedCity);
    }
    fetchCityPulse(selectedCity);
  }, [selectedCity]);

  const initializeApp = async () => {
    // In demo mode, use a fixed location (Victoria Island, Lagos) and skip API
    if (isDemoMode) {
      setUserLocation({ lat: 6.4316, lng: 3.4223 });
      setLocationPermission(true);
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');

    if (status === 'granted') {
      try {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
      } catch {
        setUserLocation({ lat: 6.4281, lng: 3.4219 });
      }
    } else {
      setUserLocation({ lat: 6.4281, lng: 3.4219 });
    }
    // Venue fetch handled by the selectedCity useEffect above
  };

  const onRefresh = useCallback(async () => {
    if (isDemoMode) return; // No refresh in demo mode
    setRefreshing(true);
    await fetchVenues();
    setRefreshing(false);
  }, [isDemoMode]);

  // Chevron animation for city picker
  useEffect(() => {
    Animated.timing(chevronRotate, {
      toValue: showCityPicker ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showCityPicker]);

  const chevronSpin = chevronRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Find nearest venue within 200m for rate prompt
  const nearbyVenue = useMemo(() => {
    if (!userLocation || venues.length === 0) return null;
    // In demo mode, always show rate FAB for the first venue
    if (isDemoMode && venues.length > 0) {
      return { id: venues[0].id, name: venues[0].name, distance: 0 };
    }
    let closest: { id: string; name: string; distance: number } | null = null;
    for (const v of venues) {
      if (!v.coordinates?.lat || !v.coordinates?.lng) continue;
      const dist = calculateDistance(
        userLocation.lat, userLocation.lng,
        v.coordinates.lat, v.coordinates.lng
      );
      if (dist <= 200 && (!closest || dist < closest.distance)) {
        closest = { id: v.id, name: v.name, distance: dist };
      }
    }
    return closest;
  }, [userLocation, venues, isDemoMode]);

  // Category counts for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of venues) {
      const type = (v as any).venue_type || 'other';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }, [venues]);

  // Filter venues by selected category, then sort by persona preference + vibe score
  const filteredVenues = useMemo(() => {
    const base = selectedCategory === 'all'
      ? [...venues]
      : venues.filter((v: any) => v.venue_type === selectedCategory);

    if (!vibePersona || selectedCategory !== 'all') {
      // No persona or specific category selected → sort by vibe score only
      return base.sort((a: any, b: any) => (b.vibe_score ?? 0) - (a.vibe_score ?? 0));
    }

    const preferred = PERSONA_BOOST[vibePersona] ?? [];
    return base.sort((a: any, b: any) => {
      const aMatch = preferred.includes(a.venue_type) ? 1 : 0;
      const bMatch = preferred.includes(b.venue_type) ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch; // preferred types first
      return (b.vibe_score ?? 0) - (a.vibe_score ?? 0); // then by vibe score
    });
  }, [venues, selectedCategory, vibePersona]);

  // DNA-powered VibeMatch: blend affinity (40%) + vibe score (60%) → top match
  const vibeMatchVenue = useMemo(() => {
    if (isDemoMode) return DEMO_VIBE_MATCH;
    if (!vibeDNA || !venues.length) return null;
    const top = venues
      .map((v: any) => {
        const affinity = vibeDNA.affinities.find((a) => a.venue_type === v.venue_type);
        const dnaScore = affinity?.score ?? 50;
        const matchPercent = Math.round(dnaScore * 0.4 + (v.current_vibe_score ?? 50) * 0.6);
        const reason = affinity
          ? `${dnaScore}% affinity for ${v.venue_type}s · Vibe score ${v.current_vibe_score ?? '?'}`
          : `Trending in ${v.area || selectedCity}`;
        return { venueName: v.name, venueId: v.id, venueArea: v.area, matchPercent, vibeScore: v.current_vibe_score ?? 50, energyLevel: v.energy_level ?? 'popping', reason };
      })
      .sort((a, b) => b.matchPercent - a.matchPercent)[0];
    return top ?? null;
  }, [vibeDNA, venues, isDemoMode]);

  // Night phase detection
  const nightPhase = useMemo(() =>
    getNightPhase(activeCheckin, isDemoMode),
    [activeCheckin, isDemoMode]
  );

  // City name for TonightHero
  const cityName = useMemo(() =>
    CITIES.find(c => c.code === selectedCity)?.name || 'Lagos',
    [selectedCity]
  );

  // Venues with score ≥ 60 = "live" for TheWave spotsLive count
  const spotsLive = useMemo(() =>
    venues.filter((v: any) => (v.current_vibe_score ?? 0) >= 60).length,
    [venues]
  );

  // VibeMarket venues — all venues sorted by score, mapped to market format
  const vibeMarketVenues = useMemo((): VibeMarketVenue[] => {
    const base: any[] = isDemoMode ? DEMO_VENUES : venues;
    if (base.length === 0) return [];
    return [...base]
      .sort((a: any, b: any) => {
        const pulseDiff = (b.pulse?.count ?? 0) - (a.pulse?.count ?? 0);
        if (pulseDiff !== 0) return pulseDiff;
        return (b.current_vibe_score ?? 0) - (a.current_vibe_score ?? 0);
      })
      .map((v: any) => ({
        id: v.id,
        name: v.name,
        area: v.area,
        current_vibe_score: v.current_vibe_score ?? 0,
        vibe_velocity: v.vibe_velocity ?? 'stable',
        energy_level: v.energy_level,
        pulse_count: v.pulse?.count ?? 0,
        pulse_tier: v.pulse?.tier ?? 'dormant',
      }));
  }, [isDemoMode, venues]);

  // New user = no check-in and no persona set yet
  // These users see CityWelcomeCard instead of TonightHero
  const isNewUser = !activeCheckin && !vibePersona;

  // Full data for nearby venue (for NoDulling pulse tier)
  const nearbyVenueFullData = useMemo(() => {
    if (!nearbyVenue) return null;
    const base: any[] = isDemoMode ? DEMO_VENUES : venues;
    return base.find((v: any) => v.id === nearbyVenue.id) ?? null;
  }, [nearbyVenue, isDemoMode, venues]);

  // Handle category change with electric transition
  const handleCategoryChange = (cat: VenueCategory) => {
    if (cat !== selectedCategory) {
      setShowTransition(true);
      setSelectedCategory(cat);
    }
  };

  // Skeleton loading state
  if (loading && !venues.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, styles.headerGlow]}>VIBE</Text>
            <Text style={styles.headerSubtitle}>Loading...</Text>
          </View>
        </View>
        <View style={styles.skeletonContent}>
          <SkeletonLoader width="100%" height={320} borderRadius={16} style={{ marginBottom: 12 }} />
          <SkeletonLoader.VenueCard />
          <SkeletonLoader.VenueCard />
          <SkeletonLoader.VenueCard />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DemoModeBanner />
      {/* Header with neon glow */}
      <View style={styles.header}>
        <View>
          <Animated.Text
            style={[
              styles.headerTitle,
              styles.headerGlow,
              { textShadowRadius: headerGlowAnim.interpolate({ inputRange: [0.6, 1], outputRange: [8, 20] }) },
            ]}
          >
            VIBE
          </Animated.Text>
          <TouchableOpacity
            style={styles.citySelector}
            onPress={() => setShowCityPicker(true)}
          >
            <Text style={styles.headerSubtitle}>
              {CITIES.find(c => c.code === selectedCity)?.emoji} {CITIES.find(c => c.code === selectedCity)?.tagline}
            </Text>
            <Animated.View style={{ transform: [{ rotate: chevronSpin }] }}>
              <Ionicons name="chevron-down" size={14} color="#FF3366" />
            </Animated.View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          {/* TheWave — live city energy visualizer */}
          <TheWave
            energy={cityPulse?.pulse_score ?? 40}
            spotsLive={spotsLive}
            cityName={cityName}
          />
          <TouchableOpacity
            style={styles.plannerButton}
            onPress={() => setShowPlanner(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={20} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setShowList(!showList)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showList ? 'map' : 'list'}
              size={22}
              color="#FF3366"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* City Picker Modal */}
      <Modal
        visible={showCityPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            {CITIES.map((city) => (
              <TouchableOpacity
                key={city.code}
                style={[
                  styles.cityOption,
                  selectedCity === city.code && styles.cityOptionActive
                ]}
                onPress={() => {
                  setSelectedCity(city.code);
                  setShowCityPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cityEmoji}>{city.emoji}</Text>
                <Text style={[
                  styles.cityName,
                  selectedCity === city.code && styles.cityNameActive
                ]}>
                  {city.name}
                </Text>
                {selectedCity === city.code && (
                  <Ionicons name="checkmark-circle" size={22} color="#FF3366" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Clout Reward Animation */}
      <CloutReward
        visible={showCloutReward}
        onAnimationComplete={() => setShowCloutReward(false)}
      />

      {showList ? (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3366" />
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* ActivityTicker — always visible; demo data seeds the feed until real activity flows */}
          <ActivityTicker items={DEMO_ACTIVITY_FEED} />

          {/* WeekendCard — Friday 6PM+ and Saturday only, dismissable */}
          {isWeekendActive && !weekendDismissed && (
            <WeekendCard
              pulseScore={cityPulse?.pulse_score ?? 50}
              onDismiss={() => setWeekendDismissed(true)}
              onExplore={() => router.push('/(public)/trending')}
            />
          )}

          {/* CityWelcomeCard — first-impression hook for new users */}
          {isNewUser && (
            <CityWelcomeCard
              cityPulse={cityPulse}
              cityName={cityName}
              onPlannerPress={() => setShowPlanner(true)}
            />
          )}

          {/* TonightHero — Adaptive journey card (returning users only) */}
          {!isNewUser && (
            <TonightHero
              phase={nightPhase}
              currentHour={isDemoMode ? DEMO_TONIGHT.currentHour : new Date().toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}
              cityName={cityName}
              cityEnergy={isDemoMode ? DEMO_TONIGHT.cityEnergy : 'popping'}
              cityEnergyScore={isDemoMode ? DEMO_TONIGHT.cityEnergyScore : 70}
              matchVenue={isDemoMode ? DEMO_TONIGHT.matchVenue : undefined}
              matchPercent={isDemoMode ? DEMO_TONIGHT.matchPercent : undefined}
              matchArea={isDemoMode ? DEMO_TONIGHT.matchArea : undefined}
              cartelOutCount={crew ? ((crew as any).member_details?.filter((m: any) => m.checked_in).length || 0) : 0}
              cartelTotal={crew ? ((crew as any).member_details?.length || 0) : 0}
              onSeePicksPress={() => {}}
              onMatchVenuePress={() => {
                if (isDemoMode && DEMO_TONIGHT.matchVenueId) {
                  router.push(`/venue/${DEMO_TONIGHT.matchVenueId}`);
                }
              }}
              venueName={activeCheckin?.venue_name}
              vibeScore={isDemoMode ? 87 : undefined}
              cloutEarnedTonight={isDemoMode ? 40 : undefined}
              badgeProximityText={isDemoMode ? '2 away from Night Owl' : undefined}
              onRateVibePress={() => {
                if (activeCheckin) {
                  router.push({
                    pathname: '/venue/[id]',
                    params: { id: activeCheckin.venue_id, openRateModal: 'true' },
                  });
                }
              }}
              venuesVisitedCount={isDemoMode ? 3 : 0}
              totalCloutEarned={isDemoMode ? 120 : 0}
              newBadgesCount={isDemoMode ? 1 : 0}
              bestMomentText="Quilox hit 87% while you were there"
            />
          )}

          {/* VibeBriefCard — Daily AI city briefing */}
          <VibeBriefCard city={selectedCity} isDemoMode={isDemoMode} />

          {/* MarketTeaser — top-3 preview, full leaderboard lives on Trending */}
          {vibeMarketVenues.length > 0 && (
            <MarketTeaser
              venues={vibeMarketVenues}
              cityLabel={cityPulse?.pulse_label ?? 'BUZZING'}
              onSeeMore={() => router.push('/(public)/trending')}
            />
          )}

          {/* CartelPulse — Cartel activity card */}
          {crew && isDemoMode && (
            <CartelPulse
              cartelName={(crew as any).name}
              members={(crew as any).member_details || []}
              onPress={() => router.push('/(public)/crew')}
            />
          )}

          {/* VibeMatch — DNA-powered recommendation */}
          {vibeMatchVenue && (
            <VibeMatch
              venueName={vibeMatchVenue.venueName}
              venueArea={vibeMatchVenue.venueArea}
              matchPercent={vibeMatchVenue.matchPercent}
              vibeScore={vibeMatchVenue.vibeScore}
              energyLevel={vibeMatchVenue.energyLevel}
              reason={vibeMatchVenue.reason}
              onPress={() => router.push(`/venue/${vibeMatchVenue.venueId}`)}
            />
          )}

          {/* NoDulling — Quick pulse drop when near a venue */}
          {nearbyVenue && nearbyVenueFullData && (
            <NoDulling
              venueName={nearbyVenue.name}
              venueId={nearbyVenue.id}
              pulseTier={nearbyVenueFullData.pulse?.tier ?? 'stirring'}
              onDrop={async (id) => {
                const loc = userLocation ?? { lat: 6.4316, lng: 3.4223 };
                await dropQuickPulse(id, loc.lat, loc.lng);
              }}
              onFullRate={() => router.push({
                pathname: '/venue/[id]',
                params: { id: nearbyVenue.id, openRateModal: 'true' },
              })}
              disabled={!!demoPulsedVenues?.[nearbyVenue.id]}
            />
          )}

          {/* Category filter */}
          <VenueCategoryFilter
            selected={selectedCategory}
            onSelect={handleCategoryChange}
            counts={categoryCounts}
          />

          {vibePersona && selectedCategory === 'all' && (
            <View style={styles.personaChip}>
              <Text style={styles.personaChipText}>
                {vibePersona === 'turn_up' ? '🎉' : vibePersona === 'grown_sexy' ? '🍸' : vibePersona === 'culture' ? '🎵' : '🌙'}{' '}
                Sorted for your vibe
              </Text>
            </View>
          )}

          {filteredVenues.map((venue, index) => (
              <Animated.View
                key={venue.id}
                style={{
                  opacity: 1,
                  transform: [{ translateY: 0 }],
                }}
              >
                <VenueCard
                  venue={venue}
                  onPress={() => router.push(`/venue/${venue.id}`)}
                  isNearby={nearbyVenue?.id === venue.id}
                  onRatePress={nearbyVenue?.id === venue.id ? () => {
                    router.push({
                      pathname: '/venue/[id]',
                      params: { id: venue.id, openRateModal: 'true' },
                    });
                  } : undefined}
                />
              </Animated.View>
            ))}

        </ScrollView>
      ) : (
        <View style={styles.mapContainer}>
          <ErrorBoundary label="Map">
            <MockMap
              venues={venues}
              userLocation={userLocation}
              onVenuePress={(venue) => router.push(`/venue/${venue.id}`)}
              highlightedVenueId={highlightedVenueId}
              ratedGlowVenueId={ratedGlowVenueId}
            />
          </ErrorBoundary>
          {/* Legend overlay on map */}
          <View style={styles.legendOverlay}>
            {[
              { color: '#3399FF', label: 'Chill' },
              { color: '#9933FF', label: 'Moderate' },
              { color: '#FF9933', label: 'Popping' },
              { color: '#FF3366', label: 'Electric', pulse: true },
            ].map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={styles.legendDotContainer}>
                  {item.pulse && (
                    <Animated.View
                      style={[
                        styles.legendDotGlow,
                        {
                          backgroundColor: item.color + '30',
                          transform: [{ scale: legendElectricPulse }],
                        },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: item.color },
                      neonGlow(item.color, 'soft'),
                    ]}
                  />
                </View>
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Rate Prompt FAB - Shows on map when near a venue */}
      {!showList && nearbyVenue && (
        <RatePromptFAB
          venueId={nearbyVenue.id}
          venueName={nearbyVenue.name}
          visible={true}
        />
      )}

      {/* Electric transition for category switches */}
      <ElectricTransition
        visible={showTransition}
        mode="flash"
        duration={300}
        onComplete={() => setShowTransition(false)}
      />

      <FloorSwitcher currentFloor="public" />

      {/* Ask Vibe Modal */}
      <ErrorBoundary label="Night Planner">
        <NightPlannerModal
          visible={showPlanner}
          onClose={() => setShowPlanner(false)}
          city={selectedCity}
        />
      </ErrorBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  skeletonContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF3366',
    letterSpacing: 6,
  },
  headerGlow: {
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: 'rgba(255,51,102,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.15)',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plannerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#151520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,51,102,0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#0A0A0F',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cityOptionActive: {
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderColor: '#FF3366',
  },
  cityEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    flex: 1,
  },
  cityNameActive: {
    color: '#FFF',
  },
  personaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,51,102,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
    marginLeft: 16,
  },
  personaChipText: {
    color: '#FF3366',
    fontSize: 12,
    fontWeight: '600',
  },
  legendOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,15,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 12,
    zIndex: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotContainer: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotGlow: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendText: {
    color: '#999',
    fontSize: 11,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
