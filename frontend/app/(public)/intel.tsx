/**
 * PUBLIC FLOOR - Intel Screen
 * VIIBE's AI-powered intelligence hub.
 *
 * Houses: Scene Planner (Claude AI) · Vibe DNA · Vibe Oracle · Scene Mode
 * These features were previously scattered and hidden — now first-class.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../../src/store/vibeStore';
import VibeDNACard from '../../src/components/VibeDNACard';
import NightPlannerModal from '../../src/components/NightPlannerModal';
import VibePlusModal from '../../src/components/VibePlusModal';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import { DEMO_ORACLE_PREDICTIONS } from '../../src/data/demoData';

export default function IntelScreen() {
  const router = useRouter();
  const userMode = useVibeStore(s => s.userMode);
  const setUserMode = useVibeStore(s => s.setUserMode);
  const isDemoMode = useVibeStore(s => s.isDemoMode);
  const selectedCity = useVibeStore(s => s.selectedCity);
  const user = useVibeStore(s => s.user);
  const [showPlanner, setShowPlanner] = useState(false);
  const [showVibePlus, setShowVibePlus] = useState(false);

  const city = (selectedCity as string) ?? 'LOS';

  const isVibePlus = () => {
    const { user } = useVibeStore.getState();
    const now = new Date();
    return !!(user?.is_vibe_plus && (!user?.vibe_plus_expires_at || new Date(user.vibe_plus_expires_at) > now));
  };

  // Top oracle venues for preview row (demo data)
  const oracleVenues = isDemoMode
    ? Object.values(DEMO_ORACLE_PREDICTIONS).slice(0, 4)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>INTEL</Text>
          <Text style={styles.headerSub}>AI-powered scene intelligence</Text>
        </View>
        <View style={styles.headerBadge}>
          <LinearGradient
            colors={['#7B2FBE', '#9B59B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBadgeGrad}
          >
            <Ionicons name="sparkles" size={12} color="#FFF" />
            <Text style={styles.headerBadgeText}>POWERED BY CLAUDE</Text>
          </LinearGradient>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── SCENE PLANNER ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SCENE PLANNER</Text>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              isVibePlus() ? setShowPlanner(true) : setShowVibePlus(true);
            }}
          >
            <LinearGradient
              colors={['#1A0A2E', '#110A22', '#0E0818']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.plannerCard}
            >
              {/* Purple glow accent */}
              <View style={styles.plannerGlow} />

              <View style={styles.plannerTop}>
                <View style={styles.plannerIconWrap}>
                  <LinearGradient
                    colors={['#9B59B6', '#7B2FBE']}
                    style={styles.plannerIconGrad}
                  >
                    <Ionicons name="sparkles" size={22} color="#FFF" />
                  </LinearGradient>
                </View>
                <View style={styles.plannerText}>
                  <Text style={styles.plannerTitle}>Plan My Scene</Text>
                  <Text style={styles.plannerDesc}>
                    Tell Claude what you're feeling — it picks your perfect venues, timing and route.
                  </Text>
                </View>
              </View>

              <View style={styles.plannerFooter}>
                <View style={styles.plannerExamples}>
                  {['"Something low-key but upscale"', '"Best club energy after midnight"'].map(ex => (
                    <View key={ex} style={styles.exampleChip}>
                      <Text style={styles.exampleText}>{ex}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.plannerCta}>
                  <Text style={styles.plannerCtaText}>Start Planning</Text>
                  <Ionicons name="arrow-forward" size={14} color="#9B59B6" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── VIBE DNA ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR VIBE DNA</Text>
          <Text style={styles.sectionSub}>Derived from your rating history</Text>
          <ErrorBoundary label="VibeDNA">
            <VibeDNACard userId={user?.id ?? ''} />
          </ErrorBoundary>
        </View>

        {/* ── VIBE ORACLE ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>VIBE ORACLE</Text>
              <Text style={styles.sectionSub}>Predictive energy forecasts per venue</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(public)/trending');
              }}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={13} color="#666" />
            </TouchableOpacity>
          </View>

          {oracleVenues.length > 0 ? (
            oracleVenues.map((pred: any) => (
              <TouchableOpacity
                key={pred.venue_id}
                style={styles.oracleRow}
                activeOpacity={0.78}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/venue/${pred.venue_id}`);
                }}
              >
                <LinearGradient
                  colors={['#0D0D1A', '#111120']}
                  style={styles.oracleRowGrad}
                >
                  <View style={styles.oracleConfidenceDot}>
                    <View style={[
                      styles.oracleDot,
                      {
                        backgroundColor:
                          pred.confidence >= 80 ? '#FF3366' :
                          pred.confidence >= 60 ? '#FF9933' : '#3399FF',
                      },
                    ]} />
                  </View>
                  <View style={styles.oracleContent}>
                    <Text style={styles.oracleVenue} numberOfLines={1}>{pred.venue_id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</Text>
                    <Text style={styles.oracleHeadline} numberOfLines={2}>{pred.headline}</Text>
                  </View>
                  <View style={styles.oracleMeta}>
                    <Text style={styles.oracleConfText}>{pred.confidence}%</Text>
                    <Ionicons name="chevron-forward" size={14} color="#333" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.oracleEmpty}>
              <Ionicons name="eye-outline" size={32} color="#333" />
              <Text style={styles.oracleEmptyText}>Oracle predictions load from live data.</Text>
              <Text style={styles.oracleEmptySubText}>Visit a venue page to see its forecast.</Text>
            </View>
          )}
        </View>

        {/* ── SCENE MODE ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SCENE MODE</Text>
          <Text style={styles.sectionSub}>How you experience VIIBE</Text>

          <View style={styles.modeRow}>
            {[
              {
                key: 'scout',
                icon: '📡',
                title: 'Scout Mode',
                desc: 'Gamified feed with clout, ratings, leaderboards and crew action.',
              },
              {
                key: 'insider',
                icon: '🔭',
                title: 'Insider Mode',
                desc: 'Clean Intel feed — scene summaries, no clout prompts. Pure signal.',
              },
            ].map(mode => {
              const isActive = (userMode ?? 'scout') === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[styles.modeCard, isActive && styles.modeCardActive]}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setUserMode(mode.key as 'scout' | 'insider');
                  }}
                >
                  <Text style={styles.modeIcon}>{mode.icon}</Text>
                  <Text style={[styles.modeTitle, isActive && styles.modeTitleActive]}>
                    {mode.title}
                  </Text>
                  <Text style={styles.modeDesc}>{mode.desc}</Text>
                  {isActive && (
                    <View style={styles.modeActiveDot}>
                      <View style={styles.modeActiveDotInner} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Scene Planner Modal */}
      <ErrorBoundary label="Scene Planner">
        <NightPlannerModal
          visible={showPlanner}
          onClose={() => setShowPlanner(false)}
          city={city}
        />
      </ErrorBoundary>

      <VibePlusModal
        visible={showVibePlus}
        onClose={() => setShowVibePlus(false)}
        onSuccess={() => { setShowVibePlus(false); setShowPlanner(true); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080810',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {},
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 4,
  },
  headerSub: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerBadge: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerBadgeGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  headerBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  scroll: {
    paddingTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#444',
    letterSpacing: 2,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeAllText: {
    fontSize: 12,
    color: '#666',
  },

  // Scene Planner card
  plannerCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(155,89,182,0.3)',
    overflow: 'hidden',
  },
  plannerGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(123,47,190,0.18)',
  },
  plannerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  plannerIconWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  plannerIconGrad: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannerText: {
    flex: 1,
  },
  plannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  plannerDesc: {
    fontSize: 13,
    color: '#9B89A8',
    lineHeight: 19,
  },
  plannerFooter: {
    gap: 12,
  },
  plannerExamples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exampleChip: {
    backgroundColor: 'rgba(155,89,182,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(155,89,182,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  exampleText: {
    fontSize: 11,
    color: '#9B59B6',
    fontStyle: 'italic',
  },
  plannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plannerCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9B59B6',
  },

  // Oracle rows
  oracleRow: {
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  oracleRowGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  oracleConfidenceDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  oracleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  oracleContent: {
    flex: 1,
  },
  oracleVenue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CCC',
    marginBottom: 2,
  },
  oracleHeadline: {
    fontSize: 12,
    color: '#555',
    lineHeight: 16,
  },
  oracleMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  oracleConfText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
  },
  oracleEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  oracleEmptyText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '600',
  },
  oracleEmptySubText: {
    fontSize: 12,
    color: '#333',
  },

  // Scene Mode toggle
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#0E0E1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#1E1E2E',
  },
  modeCardActive: {
    borderColor: 'rgba(255,51,102,0.4)',
    backgroundColor: 'rgba(255,51,102,0.06)',
  },
  modeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#666',
    marginBottom: 6,
  },
  modeTitleActive: {
    color: '#FF3366',
  },
  modeDesc: {
    fontSize: 11,
    color: '#444',
    lineHeight: 16,
  },
  modeActiveDot: {
    marginTop: 10,
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,51,102,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeActiveDotInner: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF3366',
  },
});
