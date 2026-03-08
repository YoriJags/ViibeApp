/**
 * VibeDNACard — User's vibe fingerprint derived from rating history.
 * Shows on the profile screen between the Stats Grid and Streak Card.
 * Expand button opens fullscreen cinematic DNA reveal.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ActivityIndicator,
  TouchableOpacity, Modal, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import VibePlusModal from './VibePlusModal';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_MAX_WIDTH = SCREEN_WIDTH - 140;
const FS_BAR_MAX = SCREEN_WIDTH - 100;

const BAR_COLORS: Record<string, string> = {
  club:        '#FF3366',
  lounge:      '#9933FF',
  bar:         '#FF9933',
  restaurant:  '#00E676',
  concert:     '#FFD700',
  block_party: '#FF3366',
  rave:        '#FF3366',
  event:       '#00D4FF',
  church:      '#00E676',
  other:       '#3399FF',
};

const NIGHT_STYLE_ICONS: Record<string, string> = {
  early_bird:    '🌅',
  midnight_crew: '🌙',
  night_owl:     '🦉',
};

const DOMINANT_EMOJIS: Record<string, string> = {
  club:        '⚡',
  lounge:      '🍸',
  bar:         '🍺',
  restaurant:  '🍽️',
  concert:     '🎤',
  block_party: '🎉',
  rave:        '🔊',
  event:       '🎯',
  church:      '⛪',
  other:       '✨',
};

interface TapAffinity {
  venue_type: string;
  tap_count: number;
  share: number;
}

interface VibeDNACardProps {
  userId: string;
}

function typeLabel(t: string) {
  return t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function VibeDNACard({ userId }: VibeDNACardProps) {
  const { vibeDNA, fetchVibeDNA, isDemoMode, isVibePlus } = useVibeStore();
  const [narrative, setNarrative] = useState<{ narrative: string; vibe_archetype: string } | null>(null);
  const [showVibePlus, setShowVibePlus] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (userId) fetchVibeDNA(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (isDemoMode) {
      setNarrative({ narrative: "You are a late-night creature who peaks when Amapiano drops. You thrive in VIP energy but aren't precious about it — your scene is VI after midnight, always.", vibe_archetype: 'The Club Connoisseur' });
      return;
    }
    fetch(`${API_URL}/api/users/${userId}/dna-narrative`)
      .then(r => r.json())
      .then(d => { if (d.narrative) setNarrative(d); })
      .catch(() => {});
  }, [userId, isDemoMode]);

  if (!vibeDNA) return (
    <View style={styles.loadingCard}>
      <ActivityIndicator size="small" color="#FF3366" />
      <Text style={styles.loadingText}>Computing your DNA...</Text>
    </View>
  );

  if (vibeDNA.insufficient_data) return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>🧬</Text>
      <Text style={styles.emptyTitle}>Your Vibe DNA is loading</Text>
      <Text style={styles.emptySubtitle}>Rate 3+ venues and we'll map your taste fingerprint</Text>
    </View>
  );

  const dominantEmoji = DOMINANT_EMOJIS[vibeDNA.dominant_type] ?? '✨';
  const dominantLbl   = typeLabel(vibeDNA.dominant_type);
  const nightIcon     = NIGHT_STYLE_ICONS[vibeDNA.night_style] ?? '🌙';

  // ── Inner content (shared between card + fullscreen) ───────────────────────
  const AffinityBars = ({ maxW }: { maxW: number }) => (
    <View style={styles.barsContainer}>
      {vibeDNA.affinities.map((aff: any) => {
        const color = BAR_COLORS[aff.venue_type] ?? '#3399FF';
        const barWidth = Math.max(8, (aff.score / 100) * maxW);
        return (
          <View key={aff.venue_type} style={styles.barRow}>
            <Text style={styles.barTypeLabel} numberOfLines={1}>{typeLabel(aff.venue_type)}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: barWidth, backgroundColor: color }]} />
            </View>
            <Text style={[styles.barScore, { color }]}>{aff.score}</Text>
          </View>
        );
      })}
    </View>
  );

  const NarrativeBlock = () => {
    if (narrative && isVibePlus()) return (
      <View style={styles.narrativeBox}>
        {narrative.vibe_archetype && <Text style={styles.archetypeLabel}>{narrative.vibe_archetype}</Text>}
        <Text style={styles.narrativeText}>{narrative.narrative}</Text>
      </View>
    );
    if (!isVibePlus()) return (
      <TouchableOpacity style={styles.narrativeLocked} onPress={() => setShowVibePlus(true)} activeOpacity={0.8}>
        <Ionicons name="lock-closed" size={13} color="#FFD700" />
        <View style={{ flex: 1 }}>
          <Text style={styles.narrativeLockedTitle}>AI Narrative · Viibe+</Text>
          <Text style={styles.narrativeLockedDesc}>Your full AI personality story unlocks at ₦1,500/mo</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color="rgba(255,215,0,0.5)" />
      </TouchableOpacity>
    );
    return null;
  };

  return (
    <>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dnaIcon}>🧬</Text>
            <Text style={styles.title}>VIBE DNA</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerSub}>Your taste fingerprint</Text>
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFullscreen(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="expand-outline" size={15} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dominant scene badge */}
        <View style={styles.dominantBadge}>
          <Text style={styles.dominantEmoji}>{dominantEmoji}</Text>
          <View>
            <Text style={styles.dominantLabel}>Your Dominant Scene</Text>
            <Text style={styles.dominantValue}>{dominantLbl}s</Text>
          </View>
        </View>

        {/* Night style chip */}
        <View style={styles.nightStyleChip}>
          <Text style={styles.nightStyleIcon}>{nightIcon}</Text>
          <Text style={styles.nightStyleText}>{vibeDNA.night_style_label}</Text>
        </View>

        {/* Affinity bars */}
        <AffinityBars maxW={BAR_MAX_WIDTH} />

        {/* Bolt affinity */}
        {vibeDNA.tap_affinities && vibeDNA.tap_affinities.length > 0 && (
          <View style={styles.tapSection}>
            <View style={styles.tapHeader}>
              <Text style={styles.tapIcon}>⚡</Text>
              <Text style={styles.tapTitle}>BOLT AFFINITY</Text>
              <Text style={styles.tapSub}>Where you electrify most</Text>
            </View>
            <View style={styles.tapBars}>
              {(vibeDNA.tap_affinities as TapAffinity[]).slice(0, 4).map((aff) => (
                <View key={aff.venue_type} style={styles.tapBarRow}>
                  <Text style={styles.tapBarLabel} numberOfLines={1}>{typeLabel(aff.venue_type)}</Text>
                  <View style={styles.tapBarTrack}>
                    <View style={[styles.tapBarFill, { width: `${aff.share}%` as any }]} />
                  </View>
                  <Text style={styles.tapBarCount}>{aff.tap_count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <NarrativeBlock />
        <Text style={styles.footer}>Based on {vibeDNA.total_ratings_analyzed} ratings</Text>
      </View>

      {/* Fullscreen DNA reveal */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <View style={fs.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={{ flex: 1 }}>
            {/* FS Header */}
            <View style={fs.header}>
              <View style={styles.headerLeft}>
                <Text style={{ fontSize: 20 }}>🧬</Text>
                <Text style={fs.title}>VIBE DNA</Text>
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              {/* Hero identity card */}
              <View style={fs.heroCard}>
                <Text style={fs.heroEmoji}>{dominantEmoji}</Text>
                <Text style={fs.heroType}>{dominantLbl}s</Text>
                <Text style={fs.heroNightStyle}>{nightIcon}  {vibeDNA.night_style_label}</Text>
                {narrative?.vibe_archetype && (
                  <View style={fs.archetypePill}>
                    <Text style={fs.archetypeText}>{narrative.vibe_archetype}</Text>
                  </View>
                )}
              </View>

              {/* Affinity section */}
              <View style={fs.section}>
                <Text style={fs.sectionLabel}>SCENE AFFINITY</Text>
                <AffinityBars maxW={FS_BAR_MAX} />
              </View>

              {/* Bolt affinity */}
              {vibeDNA.tap_affinities && vibeDNA.tap_affinities.length > 0 && (
                <View style={[fs.section, styles.tapSection]}>
                  <View style={styles.tapHeader}>
                    <Text style={styles.tapIcon}>⚡</Text>
                    <Text style={styles.tapTitle}>BOLT AFFINITY</Text>
                    <Text style={styles.tapSub}>Where you electrify most</Text>
                  </View>
                  <View style={styles.tapBars}>
                    {(vibeDNA.tap_affinities as TapAffinity[]).map((aff) => (
                      <View key={aff.venue_type} style={styles.tapBarRow}>
                        <Text style={styles.tapBarLabel} numberOfLines={1}>{typeLabel(aff.venue_type)}</Text>
                        <View style={styles.tapBarTrack}>
                          <View style={[styles.tapBarFill, { width: `${aff.share}%` as any }]} />
                        </View>
                        <Text style={styles.tapBarCount}>{aff.tap_count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Narrative */}
              <View style={fs.section}>
                <NarrativeBlock />
              </View>

              <Text style={[styles.footer, { marginHorizontal: 16 }]}>Based on {vibeDNA.total_ratings_analyzed} ratings · Viibe DNA</Text>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <VibePlusModal
        visible={showVibePlus}
        onClose={() => setShowVibePlus(false)}
        onSuccess={() => setShowVibePlus(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginVertical: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.2)',
    overflow: 'hidden', padding: 16, gap: 12,
  },
  loadingCard: {
    marginHorizontal: 16, marginVertical: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.15)',
    padding: 24, alignItems: 'center', gap: 8,
  },
  loadingText: { color: '#666', fontSize: 13 },
  emptyCard: {
    marginHorizontal: 16, marginVertical: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.12)',
    padding: 24, alignItems: 'center', gap: 8,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dnaIcon: { fontSize: 16 },
  title: { color: '#FF3366', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  headerSub: { color: '#555', fontSize: 11 },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  dominantBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,51,102,0.1)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.2)',
  },
  dominantEmoji: { fontSize: 24 },
  dominantLabel: { color: '#888', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  dominantValue: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  nightStyleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  nightStyleIcon: { fontSize: 14 },
  nightStyleText: { color: '#CCC', fontSize: 12, fontWeight: '500' },
  barsContainer: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTypeLabel: { color: '#888', fontSize: 11, width: 72, flexShrink: 0 },
  barTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barScore: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' },
  tapSection: {
    backgroundColor: 'rgba(102,85,255,0.06)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(102,85,255,0.18)', gap: 8,
  },
  tapHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tapIcon: { fontSize: 13 },
  tapTitle: { color: '#6655FF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tapSub: { color: '#555', fontSize: 10, marginLeft: 'auto' },
  tapBars: { gap: 5 },
  tapBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tapBarLabel: { color: '#777', fontSize: 10, width: 68, flexShrink: 0 },
  tapBarTrack: { flex: 1, height: 4, backgroundColor: 'rgba(102,85,255,0.12)', borderRadius: 2, overflow: 'hidden' },
  tapBarFill: { height: 4, backgroundColor: '#6655FF', borderRadius: 2 },
  tapBarCount: { fontSize: 10, fontWeight: '700', color: '#6655FF', width: 26, textAlign: 'right' },
  narrativeBox: {
    backgroundColor: 'rgba(255,51,102,0.06)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.12)', gap: 4,
  },
  archetypeLabel: { color: '#FF3366', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  narrativeText: { color: '#CCC', fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  narrativeLocked: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', padding: 12,
  },
  narrativeLockedTitle: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  narrativeLockedDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  footer: { color: '#555', fontSize: 11, textAlign: 'right' },
});

const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,51,102,0.15)',
  },
  title: { fontSize: 14, fontWeight: '900', color: '#FF3366', letterSpacing: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { paddingBottom: 40 },
  heroCard: {
    margin: 16, padding: 28, borderRadius: 20,
    backgroundColor: 'rgba(255,51,102,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.2)',
    alignItems: 'center', gap: 8,
  },
  heroEmoji: { fontSize: 52 },
  heroType: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  heroNightStyle: { fontSize: 14, color: '#888', fontWeight: '500' },
  archetypePill: {
    marginTop: 4, backgroundColor: 'rgba(255,51,102,0.15)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.3)',
  },
  archetypeText: { color: '#FF3366', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionLabel: { fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
});
