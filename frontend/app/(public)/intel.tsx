/**
 * Intel Screen — VIIBE's scene intelligence hub.
 *
 * Products:
 *   City Zones      — area-level heat map, which neighbourhoods are alive
 *   Dark Horse      — AI-spotted venues heating under the radar
 *   Scout Leaderboard — top scouts in your city this week
 *   Scene Planner   — Claude AI night planning
 *   Vibe DNA        — your rating-derived taste profile
 *   Scene Mode      — Scout ↔ Insider toggle
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../../src/store/vibeStore';
import VibeDNACard from '../../src/components/VibeDNACard';
import CosmicVibeCard from '../../src/components/CosmicVibeCard';
import NarrativeDivider from '../../src/components/NarrativeDivider';
import analytics, { EVENT } from '../../src/services/analytics';
import NightPlannerModal from '../../src/components/NightPlannerModal';
import VibePlusModal from '../../src/components/VibePlusModal';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import {
  DEMO_VENUES,
  DEMO_ORACLE_PREDICTIONS,
  DEMO_DARK_HORSES,
  DEMO_COSMIC_READING,
} from '../../src/data/demoData';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zoneColor(state: string) {
  if (state === 'electric') return '#FF3366';
  if (state === 'popping')  return '#FF9933';
  if (state === 'warming')  return '#9933FF';
  return '#3399FF';
}

function scoutTierColor(tier: string) {
  if (tier === 'legend') return '#FFD700';
  if (tier === 'icon')   return '#FF3366';
  if (tier === 'elite')  return '#9933FF';
  return '#3399FF';
}

function scoutTierEmoji(tier: string) {
  if (tier === 'legend') return '👑';
  if (tier === 'icon')   return '🔥';
  if (tier === 'elite')  return '⚡';
  return '🎯';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <View style={{ marginBottom: sub ? 10 : 14 }}>
      <Text style={s.sectionLabel}>{label}</Text>
      {sub && <Text style={s.sectionSub}>{sub}</Text>}
    </View>
  );
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <View style={s.emptyWrap}>
      <Ionicons name={icon as any} size={28} color="#2A2A3E" />
      <Text style={s.emptyText}>{text}</Text>
      {sub && <Text style={s.emptySub}>{sub}</Text>}
    </View>
  );
}

// ─── City Zones ───────────────────────────────────────────────────────────────

function CityZones({ city, isDemoMode, onZonePress }: {
  city: string; isDemoMode: boolean; onZonePress: (area: string) => void;
}) {
  const [zones, setZones] = useState<any[]>([]);

  useEffect(() => {
    if (isDemoMode) {
      // Derive from demo venues
      const map: Record<string, number[]> = {};
      DEMO_VENUES.forEach((v: any) => {
        if (!map[v.area]) map[v.area] = [];
        map[v.area].push(v.current_vibe_score);
      });
      const derived = Object.entries(map).map(([area, scores]) => {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const state = avg >= 75 ? 'electric' : avg >= 55 ? 'popping' : avg >= 35 ? 'warming' : 'quiet';
        return { area, avg_score: avg, venue_count: scores.length, state, trending: avg > 60 ? 'rising' : 'stable' };
      }).sort((a, b) => b.avg_score - a.avg_score);
      setZones(derived);
      return;
    }
    fetch(`${API_URL}/api/area-pulse/${city}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setZones(d.sort((a, b) => b.avg_score - a.avg_score)); })
      .catch(() => {});
  }, [city, isDemoMode]);

  if (!zones.length) return <EmptyState icon="map-outline" text="Zone data loading…" />;

  return (
    <View style={s.zonesGrid}>
      {zones.map((z, i) => {
        const col = zoneColor(z.state);
        return (
          <TouchableOpacity
            key={z.area}
            style={[s.zoneCard, { borderColor: col + '30' }]}
            onPress={() => onZonePress(z.area)}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={[col + '12', 'transparent']}
              style={s.zoneGrad}
            >
              {i === 0 && (
                <View style={[s.hotZoneBadge, { backgroundColor: col + '20' }]}>
                  <Text style={[s.hotZoneBadgeText, { color: col }]}>🔥 HOTTEST</Text>
                </View>
              )}
              <View style={[s.zoneBar, { backgroundColor: col + '18' }]}>
                <View style={[s.zoneBarFill, { width: `${z.avg_score}%` as any, backgroundColor: col }]} />
              </View>
              <Text style={[s.zoneScore, { color: col }]}>{z.avg_score}</Text>
              <Text style={s.zoneArea} numberOfLines={1}>{z.area}</Text>
              <Text style={s.zoneVenueCount}>{z.venue_count} venues</Text>
              {z.trending === 'rising' && (
                <View style={[s.zoneTrendBadge, { backgroundColor: col + '15' }]}>
                  <Text style={[s.zoneTrendText, { color: col }]}>▲ RISING</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Dark Horse ───────────────────────────────────────────────────────────────

function DarkHorse({ venues, isDemoMode, onVenuePress, vibeDNA }: {
  venues: any[]; isDemoMode: boolean; onVenuePress: (id: string) => void; vibeDNA?: any;
}) {
  const darkHorses = (isDemoMode ? DEMO_DARK_HORSES : venues.filter(
    (v: any) => v.vibe_velocity === 'heating_up' && v.current_vibe_score < 62
  ))
    .map((v: any) => {
      const affinity = vibeDNA?.affinities?.find((a: any) => a.venue_type === v.venue_type);
      const dnaScore = affinity?.score ?? 50;
      const rankScore = dnaScore * 0.5 + v.current_vibe_score * 0.5;
      return { ...v, _rankScore: rankScore, _dnaMatch: affinity ? dnaScore : null };
    })
    .sort((a: any, b: any) => b._rankScore - a._rankScore)
    .slice(0, 3);

  if (!darkHorses.length) {
    return <EmptyState icon="eye-outline" text="No dark horses right now" sub="Check back as the night heats up." />;
  }

  return (
    <View style={{ gap: 8 }}>
      {darkHorses.map((v: any, i: number) => (
        <TouchableOpacity key={v.id} style={s.darkHorseRow} onPress={() => onVenuePress(v.id)} activeOpacity={0.78}>
          <LinearGradient colors={['#0E0E1C', '#111120']} style={s.darkHorseGrad}>
            <View style={s.darkHorseLeft}>
              <Text style={s.darkHorseRank}>#{i + 1}</Text>
              <View style={s.darkHorseInfo}>
                <View style={s.darkHorseNameRow}>
                  <Text style={s.darkHorseName} numberOfLines={1}>{v.name}</Text>
                  <View style={s.risingChip}>
                    <Text style={s.risingChipText}>▲ CLIMBING</Text>
                  </View>
                  {v._dnaMatch !== null && v._dnaMatch >= 60 && (
                    <View style={s.darkHorseDnaChip}>
                      <Text style={s.darkHorseDnaText}>🧬 {v._dnaMatch}%</Text>
                    </View>
                  )}
                </View>
                <Text style={s.darkHorseArea}>{v.area}</Text>
              </View>
            </View>
            <View style={s.darkHorseRight}>
              <Text style={s.darkHorseScore}>{Math.round(v.current_vibe_score)}</Text>
              <Ionicons name="chevron-forward" size={13} color="#2A2A3E" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ))}
      <View style={s.darkHorseFooter}>
        <Ionicons name="sparkles" size={11} color="#9933FF" />
        <Text style={s.darkHorseFooterText}>Detected by AI · Scouts haven't arrived yet</Text>
      </View>
    </View>
  );
}

// ─── Scout Leaderboard ────────────────────────────────────────────────────────

function ScoutLeaderboard({ city, isDemoMode }: { city: string; isDemoMode: boolean }) {
  const [scouts, setScouts] = useState<any[]>([]);

  const DEMO_SCOUTS = [
    { username: 'Tunde_V',    clout_points: 4820, scout_status: 'legend', ratings_count: 143, city: 'Lagos' },
    { username: 'ZaraVibe',   clout_points: 3610, scout_status: 'icon',   ratings_count: 97,  city: 'Lagos' },
    { username: 'AdeScout',   clout_points: 2940, scout_status: 'elite',  ratings_count: 81,  city: 'Lagos' },
    { username: 'Kemi_Lux',   clout_points: 2105, scout_status: 'elite',  ratings_count: 64,  city: 'Lagos' },
    { username: 'NijaVibe01', clout_points: 1780, scout_status: 'scout',  ratings_count: 55,  city: 'Lagos' },
  ];

  useEffect(() => {
    if (isDemoMode) { setScouts(DEMO_SCOUTS); return; }
    fetch(`${API_URL}/api/leaderboard/top-scouts/${city}?limit=5`)
      .then(r => r.json())
      .then(d => { if (d.scouts?.length) setScouts(d.scouts); })
      .catch(() => {});
  }, [city, isDemoMode]);

  if (!scouts.length) return <EmptyState icon="trophy-outline" text="Loading scouts…" />;

  return (
    <View style={{ gap: 6 }}>
      {scouts.map((scout, i) => {
        const tierColor = scoutTierColor(scout.scout_status);
        return (
          <View key={scout.username} style={s.scoutRow}>
            <Text style={[s.scoutRank, i === 0 && { color: '#FFD700' }]}>#{i + 1}</Text>
            <View style={[s.scoutAvatar, { backgroundColor: tierColor + '20' }]}>
              <Text style={{ fontSize: 14 }}>{scoutTierEmoji(scout.scout_status)}</Text>
            </View>
            <View style={s.scoutInfo}>
              <Text style={s.scoutName}>{scout.username}</Text>
              <Text style={s.scoutMeta}>{scout.ratings_count} ratings · {scout.city}</Text>
            </View>
            <View style={s.scoutClout}>
              <Text style={[s.scoutCloutNum, { color: tierColor }]}>{scout.clout_points.toLocaleString()}</Text>
              <Text style={s.scoutCloutLabel}>CLOUT</Text>
            </View>
          </View>
        );
      })}
      <View style={s.leaderboardFooter}>
        <Text style={s.leaderboardFooterText}>Resets every Monday · Based on verified ratings</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function IntelScreen() {
  const router   = useRouter();
  const userMode = useVibeStore(s => s.userMode);
  const setUserMode = useVibeStore(s => s.setUserMode);
  const isDemoMode  = useVibeStore(s => s.isDemoMode);
  const selectedCity = useVibeStore(s => s.selectedCity);
  const venues   = useVibeStore(s => s.venues);
  const user        = useVibeStore(s => s.user);
  const vibeDNA     = useVibeStore(s => s.vibeDNA);
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);

  const [showPlanner,  setShowPlanner]  = useState(false);
  const [showVibePlus, setShowVibePlus] = useState(false);

  const city = (selectedCity as string) ?? 'lagos';

  const isVibePlus = () => {
    const { user } = useVibeStore.getState();
    const now = new Date();
    return !!(user?.is_vibe_plus && (!user?.vibe_plus_expires_at || new Date(user.vibe_plus_expires_at) > now));
  };

  const goVenue = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/venue/${id}`);
  };

  return (
    <SafeAreaView style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>INTEL</Text>
          <Text style={s.headerSub}>Scene intelligence · {city.toUpperCase()}</Text>
        </View>
        <LinearGradient colors={['#7B2FBE', '#9B59B6']} style={s.headerBadge}>
          <Ionicons name="sparkles" size={11} color="#FFF" />
          <Text style={s.headerBadgeText}>POWERED BY CLAUDE</Text>
        </LinearGradient>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── COSMIC VIBE READING — logged in or demo mode ── */}
        {(user?.id || isDemoMode) && (
          <CosmicVibeCard
            apiUrl={API_URL}
            authHeaders={getAuthHeaders()}
            zodiacSign={user?.zodiac_sign}
            isDemoMode={isDemoMode}
          />
        )}

        <NarrativeDivider mode="chapter" label="THE CITY" color="#3399FF" topGap={4} botGap={4} />

        {/* ── CITY ZONES ── */}
        <View style={s.section}>
          <SectionLabel
            label="CITY ZONES"
            sub="Which neighbourhoods are alive right now"
          />
          <ErrorBoundary label="CityZones">
            <CityZones
              city={city}
              isDemoMode={isDemoMode}
              onZonePress={(area) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Navigate to explore, filter by area — for now just go home
                router.push('/');
              }}
            />
          </ErrorBoundary>
        </View>

        {/* ── DARK HORSE ── */}
        <View style={s.section}>
          <SectionLabel
            label="DARK HORSE"
            sub="Heating up before the crowd arrives"
          />
          <ErrorBoundary label="DarkHorse">
            <DarkHorse venues={venues} isDemoMode={isDemoMode} onVenuePress={goVenue} vibeDNA={vibeDNA} />
          </ErrorBoundary>
        </View>

        <NarrativeDivider mode="chapter" label="MAKE YOUR MOVE" color="#9B59B6" topGap={4} botGap={4} />

        {/* ── SCENE PLANNER ── */}
        <View style={s.section}>
          <SectionLabel label="SCENE PLANNER" />
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              analytics.track(EVENT.INTEL_SECTION_VIEWED, { section: 'scene_planner' });
              isVibePlus() ? setShowPlanner(true) : setShowVibePlus(true);
            }}
          >
            <LinearGradient
              colors={['#1A0A2E', '#110A22', '#0E0818']}
              style={s.plannerCard}
            >
              <View style={s.plannerGlow} />
              <View style={s.plannerTop}>
                <LinearGradient colors={['#9B59B6', '#7B2FBE']} style={s.plannerIcon}>
                  <Ionicons name="sparkles" size={22} color="#FFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={s.plannerTitle}>Plan My Scene</Text>
                  <Text style={s.plannerDesc}>
                    Tell Claude what you're feeling — it picks your venues, timing and route.
                  </Text>
                </View>
              </View>
              <View style={s.plannerExamples}>
                {['"Something low-key but upscale"', '"Best club energy after midnight"'].map(ex => (
                  <View key={ex} style={s.exampleChip}>
                    <Text style={s.exampleText}>{ex}</Text>
                  </View>
                ))}
              </View>
              <View style={s.plannerCta}>
                <Text style={s.plannerCtaText}>Start Planning</Text>
                <Ionicons name="arrow-forward" size={14} color="#9B59B6" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── SCOUT LEADERBOARD ── */}
        <View style={s.section}>
          <SectionLabel
            label="SCOUT LEADERBOARD"
            sub="Most active scouts in your city this week"
          />
          <ErrorBoundary label="ScoutLeaderboard">
            <ScoutLeaderboard city={city} isDemoMode={isDemoMode} />
          </ErrorBoundary>
        </View>

        <NarrativeDivider mode="chapter" label="YOUR DNA" color="#FF3366" topGap={4} botGap={4} />

        {/* ── VIBE DNA ── */}
        <View style={s.section}>
          <SectionLabel
            label="YOUR VIBE DNA"
            sub="Derived from your rating history"
          />
          <ErrorBoundary label="VibeDNA">
            <VibeDNACard userId={user?.id ?? ''} />
          </ErrorBoundary>
        </View>

        {/* ── SCENE MODE ── */}
        <View style={s.section}>
          <SectionLabel label="SCENE MODE" sub="How you experience VIIBE" />
          <View style={s.modeRow}>
            {[
              { key: 'scout',   emoji: '📡', title: 'Scout Mode',   desc: 'Clout, ratings, leaderboards, crew action.' },
              { key: 'insider', emoji: '🔭', title: 'Insider Mode', desc: 'Clean Intel feed. Scene summaries, pure signal.' },
            ].map(mode => {
              const isActive = (userMode ?? 'scout') === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[s.modeCard, isActive && s.modeCardActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUserMode(mode.key as any); }}
                  activeOpacity={0.8}
                >
                  <Text style={s.modeEmoji}>{mode.emoji}</Text>
                  <Text style={[s.modeTitle, isActive && { color: '#FF3366' }]}>{mode.title}</Text>
                  <Text style={s.modeDesc}>{mode.desc}</Text>
                  {isActive && <View style={s.modeActivePill}><View style={s.modeActivePillDot} /></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <ErrorBoundary label="Scene Planner">
        <NightPlannerModal visible={showPlanner} onClose={() => setShowPlanner(false)} city={city} />
      </ErrorBoundary>
      <VibePlusModal
        visible={showVibePlus}
        onClose={() => setShowVibePlus(false)}
        onSuccess={() => { setShowVibePlus(false); setShowPlanner(true); }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080810' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: 4 },
  headerSub:   { fontSize: 11, color: '#444', marginTop: 2, letterSpacing: 0.3 },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  headerBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF', letterSpacing: 1 },

  scroll:  { paddingTop: 8 },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#444', letterSpacing: 2, marginBottom: 3 },
  sectionSub:   { fontSize: 13, color: '#888', marginBottom: 12 },

  emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 7 },
  emptyText: { fontSize: 13, color: '#333', fontWeight: '600' },
  emptySub:  { fontSize: 11, color: '#2A2A3E' },

  // City Zones
  zonesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneCard: {
    width: '47%', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1,
  },
  zoneGrad: { padding: 14, borderRadius: 14, minHeight: 110, justifyContent: 'flex-end' },
  hotZoneBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 8 },
  hotZoneBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  zoneBar: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  zoneBarFill: { height: 3, borderRadius: 2 },
  zoneScore: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  zoneArea:  { fontSize: 12, fontWeight: '700', color: '#CCC', marginTop: 1 },
  zoneVenueCount: { fontSize: 10, color: '#555', marginTop: 2 },
  zoneTrendBadge: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, marginTop: 6 },
  zoneTrendText:  { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  // Dark Horse
  darkHorseRow: { borderRadius: 14, overflow: 'hidden' },
  darkHorseGrad: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderWidth: 1, borderColor: 'rgba(153,51,255,0.12)', borderRadius: 14, gap: 12,
  },
  darkHorseLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  darkHorseRank: { fontSize: 11, fontWeight: '800', color: '#444', width: 20 },
  darkHorseInfo: { flex: 1 },
  darkHorseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
  darkHorseName: { fontSize: 13, fontWeight: '700', color: '#EEE', flexShrink: 1 },
  risingChip: { backgroundColor: 'rgba(153,51,255,0.15)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  risingChipText: { fontSize: 7, fontWeight: '900', color: '#9933FF', letterSpacing: 0.5 },
  darkHorseDnaChip: { backgroundColor: 'rgba(0,188,212,0.15)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  darkHorseDnaText: { fontSize: 7, fontWeight: '800', color: '#00BCD4' },
  darkHorseArea: { fontSize: 11, color: '#444' },
  darkHorseRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  darkHorseScore: { fontSize: 20, fontWeight: '900', color: '#9933FF' },
  darkHorseFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 2, marginTop: 4 },
  darkHorseFooterText: { fontSize: 10, color: '#333', fontStyle: 'italic' },

  // Scene Planner
  plannerCard: {
    borderRadius: 20, padding: 20, borderWidth: 0.5,
    borderColor: 'rgba(155,89,182,0.3)', overflow: 'hidden', gap: 12,
  },
  plannerGlow: {
    position: 'absolute', top: -40, right: -40, width: 140, height: 140,
    borderRadius: 70, backgroundColor: 'rgba(123,47,190,0.18)',
  },
  plannerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  plannerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  plannerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  plannerDesc:  { fontSize: 13, color: '#9B89A8', lineHeight: 19 },
  plannerExamples: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  exampleChip: {
    backgroundColor: 'rgba(155,89,182,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(155,89,182,0.3)', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 10,
  },
  exampleText: { fontSize: 11, color: '#9B59B6', fontStyle: 'italic' },
  plannerCta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plannerCtaText: { fontSize: 13, fontWeight: '700', color: '#9B59B6' },

  // Scout Leaderboard
  scoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0E0E1C', borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: '#1A1A2A',
  },
  scoutRank:   { fontSize: 11, fontWeight: '800', color: '#333', width: 22 },
  scoutAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scoutInfo:   { flex: 1 },
  scoutName:   { fontSize: 13, fontWeight: '700', color: '#EEE', marginBottom: 2 },
  scoutMeta:   { fontSize: 10, color: '#444' },
  scoutClout:  { alignItems: 'flex-end' },
  scoutCloutNum:   { fontSize: 14, fontWeight: '900' },
  scoutCloutLabel: { fontSize: 8, color: '#444', fontWeight: '700', letterSpacing: 1 },
  leaderboardFooter: { paddingHorizontal: 2, paddingTop: 6 },
  leaderboardFooterText: { fontSize: 10, color: '#2A2A3E', fontStyle: 'italic' },

  // Scene Mode
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: {
    flex: 1, backgroundColor: '#0E0E1A', borderRadius: 16,
    padding: 16, borderWidth: 0.5, borderColor: '#1E1E2E',
  },
  modeCardActive: { borderColor: 'rgba(255,51,102,0.4)', backgroundColor: 'rgba(255,51,102,0.06)' },
  modeEmoji: { fontSize: 24, marginBottom: 8 },
  modeTitle: { fontSize: 13, fontWeight: '800', color: '#555', marginBottom: 6 },
  modeDesc:  { fontSize: 11, color: '#3A3A4E', lineHeight: 16 },
  modeActivePill: {
    marginTop: 10, width: 20, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,51,102,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  modeActivePillDot: { width: 8, height: 4, borderRadius: 2, backgroundColor: '#FF3366' },
});
