import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
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
import VibeMap from '../../src/components/VibeMap';
import { VenueCard } from '../../src/components/VenueCard';
import CloutReward from '../../src/components/CloutReward';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import { neonGlow } from '../../src/theme';
import DemoModeBanner from '../../src/components/DemoModeBanner';
import FloorSwitcher from '../../src/components/FloorSwitcher';
import RatePromptFAB from '../../src/components/RatePromptFAB';
import VenueCategoryFilter, { VenueCategory } from '../../src/components/VenueCategoryFilter';
import ElectricTransition from '../../src/components/ElectricTransition';
import TonightHero from '../../src/components/TonightHero';
import { DEMO_ACTIVITY_FEED, DEMO_TONIGHT, DEMO_VIBE_MATCH, DEMO_VENUES } from '../../src/data/demoData';
import VibeMatch from '../../src/components/VibeMatch';
import NightPlannerModal from '../../src/components/NightPlannerModal';
import VibePlusModal from '../../src/components/VibePlusModal';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import TheWave from '../../src/components/TheWave';
import { VibeMarketVenue } from '../../src/components/VibeMarket';
import NoDulling from '../../src/components/NoDulling';
import CityPulseBar from '../../src/components/CityPulseBar';
import TopThreeStrip from '../../src/components/TopThreeStrip';
import ActivityTicker from '../../src/components/ActivityTicker';
import { getNightPhase } from '../../src/store/vibeStore';
import { calculateDistance } from '../../src/utils/geo';
import LivePushFeed from '../../src/components/LivePushFeed';
import * as Haptics from 'expo-haptics';
import CityWelcomeCard from '../../src/components/CityWelcomeCard';
import WeekendCard from '../../src/components/WeekendCard';
import InsiderFeed from '../../src/components/InsiderFeed';
import ScoutAuraChip from '../../src/components/ScoutAuraChip';
import VenueSpotlight from '../../src/components/VenueSpotlight';
import VibeShiftToast from '../../src/components/VibeShiftToast';
import LastCallStrip from '../../src/components/LastCallStrip';
import MissedPeaksBanner from '../../src/components/MissedPeaksBanner';
import AfterHours from '../../src/components/AfterHours';
import SwipeRate from '../../src/components/SwipeRate';
import ScoutOfTheNight from '../../src/components/ScoutOfTheNight';
import VibeBriefCard from '../../src/components/VibeBriefCard';
import AIScoutBriefing from '../../src/components/AIScoutBriefing';
import VenueBattle from '../../src/components/VenueBattle';
import HeatMapCard from '../../src/components/HeatMapCard';
import SceneMoodSelector, { SceneMood } from '../../src/components/SceneMoodSelector';
import VariableRewardOverlay, { VariableRewardRef } from '../../src/components/VariableRewardOverlay';
import VenueDiscoverFlow from '../../src/components/VenueDiscoverFlow';
import NightArcStrip from '../../src/components/NightArcStrip';
import StreakFireModal from '../../src/components/StreakFireModal';
import OracleTease from '../../src/components/OracleTease';

// ─────────────────────────────────────────────────────────────────────────────
// [CityWelcomeCard, WeekendCard, InsiderFeed extracted to src/components/]
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
  const { venues, fetchVenues, loading, error, connectSocket, selectedCity, setSelectedCity, lastRatedVenueId, setLastRatedVenueId, isDemoMode, activeCheckin, crew, vibePersona, vibeDNA, cityPulse, fetchCityPulse, dropQuickPulse, demoPulsedVenues, isFeatureEnabled, isVibePlus, user, userMode, setUserMode, tabBarHidden, setTabBarHidden, sceneMood, sceneMoodSetAt, setSceneMood } = useVibeStore();
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showList, setShowList] = useState(true); // List-first: content before map
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showCloutReward, setShowCloutReward] = useState(false);
  const [highlightedVenueId, setHighlightedVenueId] = useState<string | null>(null);
  const [ratedGlowVenueId, setRatedGlowVenueId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VenueCategory>('all');
  const [showTransition, setShowTransition] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [showVibePlus, setShowVibePlus] = useState(false);
  const [spotlightVenue, setSpotlightVenue] = useState<any>(null);
  const [weekendDismissed, setWeekendDismissed] = useState(false);
  const [showSceneMood, setShowSceneMood] = useState(false);
  const [vibeShift, setVibeShift] = useState<{ venueName: string; newTier: string; prevTier: string; venueId: string } | null>(null);
  const [showLastCall, setShowLastCall] = useState(false);
  const [showAfterHours, setShowAfterHours] = useState(false);
  const [showSwipeRate, setShowSwipeRate] = useState(false);
  const [showScoutOfNight, setShowScoutOfNight] = useState(false);
  const [showDiscoverFlow, setShowDiscoverFlow] = useState(false);
  const discoverShownRef = useRef(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [streakData, setStreakData] = useState({ streak: 3, cloutBonus: 50 });
  const [hasRatedThisSession, setHasRatedThisSession] = useState(false);
  const prevVenueTiers = useRef<Record<string, string>>({});
  const rewardRef = useRef<VariableRewardRef>(null);

  // Friday 6PM onwards or all of Saturday
  const isWeekendActive = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const hour = d.getHours();
    return (day === 5 && hour >= 18) || day === 6;
  }, []);

  // Animations
  const headerGlowAnim = useRef(new Animated.Value(0.6)).current;
  // Card entrance animations (up to 12 cards staggered)
  const cardAnims = useRef(Array.from({ length: 12 }, () => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(28),
  }))).current;
  const legendElectricPulse = useRef(new Animated.Value(1)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current;

  // Stagger venue cards on load
  useEffect(() => {
    if (!filteredVenues?.length) return;
    // Reset animations before staggering
    cardAnims.forEach(a => { a.opacity.setValue(0); a.translateY.setValue(28); });
    Animated.stagger(60, cardAnims.slice(0, Math.min(filteredVenues.length, 12)).map(a =>
      Animated.parallel([
        Animated.timing(a.opacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(a.translateY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      ])
    )).start();
  }, [filteredVenues?.length, selectedCategory]);

  // Animate header glow — slow, refined pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlowAnim, { toValue: 1, duration: 3000, useNativeDriver: false }),
        Animated.timing(headerGlowAnim, { toValue: 0.5, duration: 3000, useNativeDriver: false }),
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

  // Demo: show streak modal after 4s in demo mode (to showcase the feature)
  useEffect(() => {
    if (!isDemoMode) return;
    const timer = setTimeout(() => {
      setStreakData({ streak: 7, cloutBonus: 150 });
      setShowStreakModal(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isDemoMode]);

  // Scene Mood: prompt once per session during evening hours (6pm–4am) if not set today
  useEffect(() => {
    if (!user) return;
    const hour = new Date().getHours();
    const isEvening = hour >= 18 || hour < 4;
    if (!isEvening) return;
    const today = new Date().toDateString();
    const setToday = sceneMoodSetAt ? new Date(sceneMoodSetAt).toDateString() : null;
    if (setToday === today) return; // Already set this session
    // Small delay — let the app load first
    const timer = setTimeout(() => setShowSceneMood(true), 2500);
    return () => clearTimeout(timer);
  }, [user]);

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

  // Single source of truth for venue fetching — handles initial load + city changes + demo toggle
  useEffect(() => {
    if (!isDemoMode) {
      fetchVenues(selectedCity);
    }
    fetchCityPulse(selectedCity);
  }, [selectedCity, isDemoMode]);

  // Venue Discover Flow — show once per session when venues first load
  useEffect(() => {
    if (!discoverShownRef.current && venues.length > 0 && user) {
      discoverShownRef.current = true;
      const timer = setTimeout(() => setShowDiscoverFlow(true), 600);
      return () => clearTimeout(timer);
    }
  }, [venues.length, user]);

  // Detect vibe tier shifts when venues update
  useEffect(() => {
    if (!venues.length) return;
    venues.forEach(v => {
      const prev = prevVenueTiers.current[v.id];
      if (prev && prev !== v.energy_level) {
        // Tier changed — show toast for upgrades (or notable drops)
        const RANK: Record<string, number> = { quiet: 0, chill: 1, warming: 2, charged: 3, lit: 4, peak: 5 };
        const rankPrev = RANK[prev] ?? 0;
        const rankNew  = RANK[v.energy_level] ?? 0;
        if (Math.abs(rankNew - rankPrev) >= 1) {
          setVibeShift({ venueName: v.name, newTier: v.energy_level, prevTier: prev, venueId: v.id });
        }
      }
      prevVenueTiers.current[v.id] = v.energy_level;
    });
  }, [venues]);

  // Last Call — after 1:30 AM if there are still peak/lit venues
  useEffect(() => {
    const hour = new Date().getHours();
    const isLateNight = hour >= 1 && hour <= 5;
    if (!isLateNight) return;
    const hotVenues = venues.filter(v => v.energy_level === 'peak' || v.energy_level === 'lit');
    if (hotVenues.length > 0) {
      const timer = setTimeout(() => setShowLastCall(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [venues]);

  // After Hours — 6AM to 10AM, auto-pop your night recap once
  useEffect(() => {
    if (!user) return;
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 10) {
      const timer = setTimeout(() => setShowAfterHours(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Scout of the Night — midnight to 3AM, pop after a short delay
  useEffect(() => {
    if (!user) return;
    const hour = new Date().getHours();
    if (hour >= 0 && hour <= 3) {
      const timer = setTimeout(() => setShowScoutOfNight(true), 8000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const initializeApp = async () => {
    // In demo mode, use a fixed location (Victoria Island, Lagos) and skip API
    if (isDemoMode) {
      setUserLocation({ lat: 6.4316, lng: 3.4223 });
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();

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
    if (!vibeDNA?.affinities?.length || !venues.length) return null;
    const top = venues
      .map((v: any) => {
        const affinity = vibeDNA.affinities.find((a: any) => a.venue_type === v.venue_type);
        const dnaScore = affinity?.score ?? 50;
        const matchPercent = Math.round(dnaScore * 0.4 + (v.current_vibe_score ?? 50) * 0.6);
        const reason = affinity
          ? `${dnaScore}% affinity for ${v.venue_type}s · Vibe score ${v.current_vibe_score ?? '?'}`
          : `Trending in ${v.area || selectedCity}`;
        return { venueName: v.name, venueId: v.id, venueArea: v.area, matchPercent, vibeScore: v.current_vibe_score ?? 50, energyLevel: v.energy_level ?? 'lit', reason };
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
      {/* Venue Discover Flow — fullscreen Netflix-style on session open */}
      {showDiscoverFlow && (
        <VenueDiscoverFlow
          venues={isDemoMode ? (require('../../src/data/demoData').DEMO_VENUES as any[]) : venues}
          onFire={(venueId) => {
            dropQuickPulse(venueId, userLocation?.lat ?? 6.4281, userLocation?.lng ?? 3.4219);
            setHasRatedThisSession(true);
          }}
          onComplete={() => setShowDiscoverFlow(false)}
        />
      )}

      <DemoModeBanner />
      {/* Header with neon glow */}
      <View style={styles.header}>
        {/* LEFT: Map / List toggle */}
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowList(!showList);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showList ? 'map' : 'list'}
            size={22}
            color="#FF3366"
          />
        </TouchableOpacity>

        {/* CENTER: City selector only */}
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCityPicker(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.cityNameLarge}>
            {CITIES.find(c => c.code === selectedCity)?.name ?? 'Lagos'}
          </Text>
          <Animated.View style={{ transform: [{ rotate: chevronSpin }] }}>
            <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.4)" />
          </Animated.View>
        </TouchableOpacity>

        {/* RIGHT: Mode toggle + planner */}
        <View style={styles.headerActions}>
          {/* Mode toggle — Scout ↔ Insider */}
          <TouchableOpacity
            style={[styles.modePill, userMode === 'insider' && styles.modePillInsider]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setUserMode(userMode === 'insider' ? 'scout' : 'insider');
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.modePillText, userMode === 'insider' && { color: '#9933FF' }]}>
              {userMode === 'insider' ? '🔭' : '📡'}
            </Text>
          </TouchableOpacity>
          {isFeatureEnabled('night_planner_btn') && (
            <TouchableOpacity
              style={styles.plannerButton}
              onPress={() => isVibePlus() ? setShowPlanner(true) : setShowVibePlus(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={20} color="#FFD700" />
            </TouchableOpacity>
          )}
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
                  Haptics.selectionAsync();
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

      {showList && userMode === 'insider' ? (
        <InsiderFeed
          venues={filteredVenues}
          cityPulse={cityPulse}
          cityName={cityName}
          onVenuePress={(id) => router.push(`/venue/${id}`)}
          onSwitchMode={() => setUserMode('scout')}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      ) : showList ? (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3366" />
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* ── HERO ZONE: one editorial block before content ── */}

          {/* Scout Aura chip — persistent level indicator above the feed */}
          <ErrorBoundary label="Scout Aura Chip">
            <ScoutAuraChip />
          </ErrorBoundary>

          {/* Live activity ribbon — subtle ticker, not a blocking card */}
          <ActivityTicker items={DEMO_ACTIVITY_FEED} />

          {/* Night Arc — tonight's journey progress */}
          <ErrorBoundary label="Night Arc">
            <NightArcStrip
              hasSetMood={!!sceneMood}
              hasRatedVenue={hasRatedThisSession || !!activeCheckin}
              hasCheckedIn={!!activeCheckin}
              hasCrewActive={!!((crew as any)?.member_details?.length && (crew as any).member_details.length > 1)}
              onStepPress={(step) => {
                if (step === 'mood') setShowSceneMood(true);
                else if (step === 'rate') setShowSwipeRate(true);
                else if (step === 'checkin') router.push('/venue/' + (venues[0]?.id ?? ''));
                else if (step === 'crew') router.push('/(public)/crew');
              }}
            />
          </ErrorBoundary>

          {/* Oracle Tease — pulls users back with a cliffhanger */}
          <ErrorBoundary label="Oracle Tease">
            <OracleTease
              venues={isDemoMode ? (require('../../src/data/demoData').DEMO_VENUES as any[]) : venues}
              onVenuePress={(id) => router.push(`/venue/${id}`)}
              isDemoMode={isDemoMode}
            />
          </ErrorBoundary>

          {/* Missed Peaks — FOMO card for followed venues that peaked while you were away */}
          <ErrorBoundary label="Missed Peaks">
            <MissedPeaksBanner
              isDemoMode={isDemoMode}
              authToken={(getAuthHeaders() as any)?.Authorization?.replace('Bearer ', '')}
              onVenuePress={(id) => router.push(`/venue/${id}`)}
            />
          </ErrorBoundary>

          {/* AI Scout Briefing — personalised Claude morning/evening/night message */}
          <ErrorBoundary label="Scout Briefing">
            <AIScoutBriefing city={selectedCity} isDemoMode={isDemoMode} />
          </ErrorBoundary>

          {/* AI Daily Brief — star feature, Vibe+ full brief */}
          <ErrorBoundary label="Vibe Brief">
            <VibeBriefCard city={selectedCity} isDemoMode={isDemoMode} />
          </ErrorBoundary>

          {/* Venue Battle — real-time tap-off */}
          <ErrorBoundary label="Venue Battle">
            <VenueBattle isDemoMode={isDemoMode} />
          </ErrorBoundary>

          {/* City Heat Map — neighborhood heat intensity grid */}
          <ErrorBoundary label="Heat Map">
            <HeatMapCard city={selectedCity} isDemoMode={isDemoMode} />
          </ErrorBoundary>

          {/* Tonight's Hero — adaptive journey card; collapses for new users */}
          {isNewUser ? (
            <CityWelcomeCard
              cityPulse={cityPulse}
              cityName={cityName}
              onPlannerPress={() => setShowPlanner(true)}
            />
          ) : (
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

          {/* Top 3 Strip — tonight's hottest, immediately after hero */}
          {vibeMarketVenues.length > 0 && (
            <TopThreeStrip
              venues={vibeMarketVenues}
              onVenuePress={(id) => router.push(`/venue/${id}`)}
              onSeeMore={() => router.push('/(public)/trending')}
            />
          )}

          {/* City Pulse + Live Push: only show if there is real data */}
          {cityPulse && (
            <CityPulseBar
              pulse={cityPulse}
              onPress={() => router.push('/(public)/trending')}
            />
          )}
          <ErrorBoundary label="Live Push Feed">
            <LivePushFeed />
          </ErrorBoundary>

          {/* WeekendCard — Friday 6PM+ and Saturday only, dismissable */}
          {isWeekendActive && !weekendDismissed && (
            <WeekendCard
              pulseScore={cityPulse?.pulse_score ?? 50}
              onDismiss={() => setWeekendDismissed(true)}
              onExplore={() => router.push('/(public)/trending')}
            />
          )}

          {/* NoDulling — Quick pulse drop when near a venue */}
          {nearbyVenue && nearbyVenueFullData && (
            <View style={{ position: 'relative' }}>
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
                onVariableReward={(type) => rewardRef.current?.trigger(type)}
                disabled={!!demoPulsedVenues?.[nearbyVenue.id]}
              />
              <VariableRewardOverlay ref={rewardRef} />
            </View>
          )}

          {/* ── Quick Rate strip — swipe-to-rate entry point ── */}
          {filteredVenues.length > 0 && (
            <TouchableOpacity
              style={styles.quickRateStrip}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowSwipeRate(true); }}
              activeOpacity={0.8}
            >
              <View style={styles.quickRateDot} />
              <Text style={styles.quickRateLabel}>QUICK RATE</Text>
              <Text style={styles.quickRateSub}>Swipe through tonight's spots</Text>
              <Ionicons name="chevron-forward" size={14} color="#FF3366" />
            </TouchableOpacity>
          )}

          {/* ── VENUE LIST: Category filter → cards → inline VibeMatch ── */}
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
            <React.Fragment key={venue.id}>
              <Animated.View style={{ opacity: cardAnims[index % 12]?.opacity ?? 1, transform: [{ translateY: cardAnims[index % 12]?.translateY ?? 0 }] }}>
                <VenueCard
                  venue={venue}
                  onPress={() => setSpotlightVenue(venue)}
                  isNearby={nearbyVenue?.id === venue.id}
                  onRatePress={nearbyVenue?.id === venue.id ? () => {
                    router.push({
                      pathname: '/venue/[id]',
                      params: { id: venue.id, openRateModal: 'true' },
                    });
                  } : undefined}
                />
              </Animated.View>
              {/* VibeMatch injected inline after 2nd card — feels editorial, not blocky */}
              {index === 1 && vibeMatchVenue && (
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
            </React.Fragment>
          ))}

        </ScrollView>
      ) : (
        <View style={styles.mapContainer}>
          <ErrorBoundary label="Map">
            {Platform.OS === 'web' ? (
              <MockMap
                venues={isDemoMode ? (require('../../src/data/demoData').DEMO_VENUES as any[]) : venues}
                userLocation={userLocation}
                onVenuePress={(venue) => router.push(`/venue/${venue.id}`)}
                highlightedVenueId={highlightedVenueId}
                ratedGlowVenueId={ratedGlowVenueId}
              />
            ) : (
              <VibeMap
                venues={isDemoMode ? (require('../../src/data/demoData').DEMO_VENUES as any[]) : venues}
                userLocation={userLocation}
                onVenuePress={(venue) => router.push(`/venue/${venue.id}`)}
                highlightedVenueId={highlightedVenueId}
              />
            )}
          </ErrorBoundary>
          {/* Legend — bottom-left, compact */}
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

      {/* Floating "Show List" pill — lives outside mapContainer so tab bar never covers it */}
      {!showList && (
        <TouchableOpacity
          style={styles.floatingListPill}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowList(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="list" size={15} color="#FFF" />
          <Text style={styles.floatingListPillText}>Show List</Text>
        </TouchableOpacity>
      )}

      {/* Re-show tab bar pill — appears when tab bar is swiped away */}
      {tabBarHidden && (
        <TouchableOpacity
          style={styles.showTabBarPill}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTabBarHidden(false);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-up" size={14} color="#FF3366" />
          <Text style={styles.showTabBarText}>Show Nav</Text>
        </TouchableOpacity>
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

      <VibePlusModal
        visible={showVibePlus}
        onClose={() => setShowVibePlus(false)}
        onSuccess={() => { setShowVibePlus(false); setShowPlanner(true); }}
      />

      {/* Venue Spotlight — full-screen theater mode */}
      <VenueSpotlight
        visible={spotlightVenue !== null}
        venue={spotlightVenue}
        onClose={() => setSpotlightVenue(null)}
      />

      {/* Scene Mood — pre-session intent (once per evening) */}
      <SceneMoodSelector
        visible={showSceneMood}
        onSelect={(mood: SceneMood) => { setSceneMood(mood); setShowSceneMood(false); }}
        onSkip={() => setShowSceneMood(false)}
      />

      {/* Vibe Shift toast — venue tier change alert */}
      <VibeShiftToast
        visible={vibeShift !== null}
        venueName={vibeShift?.venueName ?? ''}
        newTier={vibeShift?.newTier ?? ''}
        prevTier={vibeShift?.prevTier}
        onPress={() => { if (vibeShift?.venueId) router.push(`/venue/${vibeShift.venueId}`); }}
        onDismiss={() => setVibeShift(null)}
      />

      {/* Last Call strip — late night peak venues still active */}
      {showLastCall && (
        <LastCallStrip
          peakCount={venues.filter(v => v.energy_level === 'peak' || v.energy_level === 'lit').length}
          onPress={() => { setShowLastCall(false); setShowList(true); }}
          onDismiss={() => setShowLastCall(false)}
        />
      )}

      {/* After Hours — night recap modal, auto-pops at 6AM */}
      <AfterHours
        visible={showAfterHours}
        onClose={() => setShowAfterHours(false)}
        isDemoMode={isDemoMode}
      />

      {/* Swipe Rate — Tinder-style quick venue rating */}
      <SwipeRate
        visible={showSwipeRate}
        venues={filteredVenues}
        onFire={(venueId) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          dropQuickPulse(venueId, userLocation?.lat ?? 6.4316, userLocation?.lng ?? 3.4223);
        }}
        onClose={() => setShowSwipeRate(false)}
        isDemoMode={isDemoMode}
      />

      {/* Scout of the Night — midnight leaderboard ceremony */}
      <ScoutOfTheNight
        visible={showScoutOfNight}
        onClose={() => setShowScoutOfNight(false)}
        isDemoMode={isDemoMode}
        city={selectedCity}
      />

      {/* Streak Fire Modal — milestone celebration at 3/7/14/30 nights */}
      <StreakFireModal
        visible={showStreakModal}
        streak={streakData.streak}
        cloutBonus={streakData.cloutBonus}
        onClaim={() => { setShowStreakModal(false); setShowCloutReward(true); }}
        onDismiss={() => setShowStreakModal(false)}
      />
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(10,10,15,0.92)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF3366',
    letterSpacing: 8,
  },
  headerGlow: {
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  cityNameLarge: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plannerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modePillInsider: {
    borderColor: 'rgba(153,51,255,0.35)',
    backgroundColor: 'rgba(153,51,255,0.07)',
  },
  modePillText: {
    fontSize: 16,
  },
  viewToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    bottom: 14,
    left: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,15,0.80)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 10,
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
  floatingListPill: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 108 : 86,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -52 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,10,18,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.35)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#FF3366',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    zIndex: 20,
  },
  floatingListPillText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  showTabBarPill: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -44 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10,10,18,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 20,
  },
  showTabBarText: {
    color: '#FF3366',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
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
    paddingHorizontal: 10,
  },
  quickRateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 4,
    marginBottom: 14,
    backgroundColor: '#0D0D1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF336622',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickRateDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3366',
  },
  quickRateLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FF3366',
    letterSpacing: 1.5,
  },
  quickRateSub: {
    fontSize: 11,
    color: '#444',
    fontWeight: '500',
    flex: 1,
  },
});
