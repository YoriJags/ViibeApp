/**
 * VibeOracle — Predictive venue intelligence card.
 * "Quilox will be electric by 12:30am tonight (89% confidence)"
 * Expand button opens fullscreen deep-dive modal.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';
import { DEMO_ORACLE_PREDICTIONS, DEMO_ORACLE_DEFAULT } from '../data/demoData';
import VibePlusModal from './VibePlusModal';

interface OracleSignal { icon: string; label: string; type: string; }

interface OraclePrediction {
  venue_id: string;
  headline: string;
  confidence: number;
  peak_window_start: string;
  peak_window_end: string;
  best_arrival: string;
  current_trajectory: 'rising' | 'peaking' | 'fading' | 'quiet';
  signals: OracleSignal[];
  generated_at: string;
  insufficient_data?: boolean;
}

interface PremiumData {
  crowd_forecast: string;
  insider_tip: string;
  peak_window: string;
  headline: string;
  powered_by: string;
}

interface VibeOracleProps {
  venueId: string;
  venueName?: string;
}

const TRAJECTORY_COLOR: Record<string, string> = {
  rising:  '#FF9800',
  peaking: '#00E676',
  fading:  '#9933FF',
  quiet:   '#666',
};

const TRAJECTORY_ICON: Record<string, string> = {
  rising:  'trending-up',
  peaking: 'flash',
  fading:  'trending-down',
  quiet:   'moon',
};

const TRAJECTORY_DESC: Record<string, string> = {
  rising:  'Vibe is building — energy climbing toward peak',
  peaking: 'At full power right now — best time to be here',
  fading:  'Peak has passed — crowd thinning out',
  quiet:   'Low activity — not the move tonight',
};

function confidenceColor(c: number) {
  if (c >= 80) return '#00E676';
  if (c >= 60) return '#FFD700';
  return '#FF9933';
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ── Confidence Ring (simulated arc) ────────────────────────────────────────
function ConfidenceRing({ confidence, color }: { confidence: number; color: string }) {
  return (
    <View style={ring.outer}>
      <View style={[ring.inner, { borderColor: color + '30' }]}>
        <View style={[ring.fill, { borderColor: color, borderTopColor: 'transparent', borderLeftColor: confidence > 50 ? color : 'transparent' }]} />
        <View style={ring.center}>
          <Text style={[ring.pct, { color }]}>{confidence}%</Text>
          <Text style={ring.label}>CONFIDENCE</Text>
        </View>
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  outer: { alignItems: 'center', marginVertical: 8 },
  inner: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  fill: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: 'transparent',
  },
  center: { alignItems: 'center', gap: 2 },
  pct: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  label: { fontSize: 8, color: '#555', fontWeight: '800', letterSpacing: 1.5 },
});

export default function VibeOracle({ venueId, venueName }: VibeOracleProps) {
  const { isDemoMode, isVibePlus, user } = useVibeStore();
  const router = useRouter();
  const [prediction, setPrediction] = useState<OraclePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumData, setPremiumData] = useState<PremiumData | null>(null);
  const [showVibePlus, setShowVibePlus] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    fetchOracle();
  }, [venueId]);

  const fetchOracle = async () => {
    setLoading(true);
    if (isDemoMode) {
      const demo = DEMO_ORACLE_PREDICTIONS[venueId] ?? DEMO_ORACLE_DEFAULT;
      setTimeout(() => {
        setPrediction(demo as OraclePrediction);
        setLoading(false);
      }, 300);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/oracle`);
      if (res.ok) {
        const data = await res.json();
        if (!data.insufficient_data) setPrediction(data);
      }
    } catch {
      // Non-critical — fail silently
    } finally {
      setLoading(false);
    }
  };

  const handlePremiumTap = () => {
    if (!user) { router.push('/(public)/profile' as any); return; }
    if (isVibePlus()) fetchPremium();
    else setShowVibePlus(true);
  };

  const fetchPremium = async () => {
    if (premiumLoading || premiumUnlocked) return;
    setPremiumLoading(true);
    if (isDemoMode) {
      setTimeout(() => {
        setPremiumData({
          crowd_forecast: 'Packed by midnight, full by 1am',
          insider_tip: 'Arrive before 12:30am to skip the VIP queue — energy hits different before it gets rowdy',
          peak_window: '12:30am – 2:30am',
          headline: prediction?.headline ?? '',
          powered_by: 'claude',
        });
        setPremiumUnlocked(true);
        setPremiumLoading(false);
      }, 1200);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/oracle/premium`);
      if (res.ok) {
        const data = await res.json();
        setPremiumData(data);
        setPremiumUnlocked(true);
      }
    } catch {
      // silently fail
    } finally {
      setPremiumLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FFD700" />
      </View>
    );
  }

  if (!prediction) return null;

  const trajectory = prediction.current_trajectory ?? 'rising';
  const tColor = TRAJECTORY_COLOR[trajectory] ?? '#FF9800';
  const tIcon  = TRAJECTORY_ICON[trajectory] ?? 'trending-up';
  const cColor = confidenceColor(prediction.confidence);

  // ── Shared: signals grid ─────────────────────────────────────────────────
  const renderSignals = (big = false) => (
    <View style={[styles.signalsRow, big && { flexWrap: 'wrap', gap: 8 }]}>
      {prediction.signals.map((signal, i) => (
        <View key={i} style={[styles.signalChip, big && fs.signalChipBig]}>
          <Text style={[styles.signalEmoji, big && { fontSize: 16 }]}>{signal.icon}</Text>
          <Text style={[styles.signalLabel, big && { fontSize: 12 }]}>{signal.label}</Text>
        </View>
      ))}
    </View>
  );

  // ── Shared: premium section ──────────────────────────────────────────────
  const renderPremium = (big = false) => (
    premiumUnlocked && premiumData ? (
      <View style={styles.premiumUnlocked}>
        <View style={styles.premiumDivider} />
        <View style={styles.premiumRow}>
          <Ionicons name="people" size={13} color="#FFD700" />
          <Text style={styles.premiumRowLabel}>Crowd forecast</Text>
          <Text style={styles.premiumRowValue}>{premiumData.crowd_forecast}</Text>
        </View>
        <View style={[styles.insiderTipBox, big && { padding: 14 }]}>
          <View style={styles.insiderTipHeader}>
            <Ionicons name="bulb" size={12} color="#9933FF" />
            <Text style={styles.insiderTipTitle}>Insider tip</Text>
          </View>
          <Text style={[styles.insiderTipText, big && { fontSize: 14, lineHeight: 21 }]}>
            {premiumData.insider_tip}
          </Text>
        </View>
        <View style={styles.claudeBadge}>
          <Text style={styles.claudeBadgeText}>✦ Powered by Claude AI</Text>
        </View>
      </View>
    ) : (
      <TouchableOpacity style={styles.premiumCTA} onPress={handlePremiumTap} activeOpacity={0.8}>
        {premiumLoading ? (
          <ActivityIndicator size="small" color="#FFD700" />
        ) : (
          <>
            <Ionicons name="lock-closed" size={13} color="#FFD700" />
            <Text style={styles.premiumCTAText}>Unlock AI Prediction</Text>
            <View style={styles.premiumCTABadge}>
              <Text style={styles.premiumCTABadgeText}>✦ Claude</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    )
  );

  return (
    <>
      <View style={styles.wrapper}>
        <LinearGradient colors={['#1A0A1A', '#0D0A1F']} style={styles.container}>
          {/* Gold left accent bar */}
          <View style={[styles.accentBar, { backgroundColor: '#FFD700' }]} />

          <View style={styles.content}>
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={styles.labelRow}>
                <Ionicons name="eye" size={13} color="#FFD700" />
                <Text style={styles.oracleLabel}>VIBE ORACLE</Text>
              </View>
              <View style={styles.headerRight}>
                <View style={[styles.confidenceBadge, { borderColor: cColor + '60', backgroundColor: cColor + '18' }]}>
                  <View style={[styles.confidenceDot, { backgroundColor: cColor }]} />
                  <Text style={[styles.confidenceText, { color: cColor }]}>{prediction.confidence}% confidence</Text>
                </View>
                <TouchableOpacity
                  style={styles.expandBtn}
                  onPress={() => setFullscreen(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="expand-outline" size={15} color="#555" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Headline */}
            <Text style={styles.headline}>{prediction.headline}</Text>

            {/* Best arrival + trajectory */}
            <View style={styles.subRow}>
              <View style={styles.arrivalRow}>
                <Ionicons name="time-outline" size={13} color="#888" />
                <Text style={styles.arrivalText}>Best time: {prediction.best_arrival}</Text>
              </View>
              <View style={[styles.trajectoryChip, { backgroundColor: tColor + '20', borderColor: tColor + '50' }]}>
                <Ionicons name={tIcon as any} size={11} color={tColor} />
                <Text style={[styles.trajectoryText, { color: tColor }]}>
                  {trajectory.charAt(0).toUpperCase() + trajectory.slice(1)}
                </Text>
              </View>
            </View>

            {/* Signal chips */}
            {renderSignals()}

            {/* Premium section */}
            {renderPremium()}
          </View>
        </LinearGradient>
      </View>

      {/* ── Fullscreen Modal ─────────────────────────────────────────────────── */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <View style={fs.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={{ flex: 1 }}>
            {/* FS Header */}
            <View style={fs.header}>
              <View style={fs.headerLeft}>
                <Ionicons name="eye" size={18} color="#FFD700" />
                <Text style={fs.title}>VIBE ORACLE</Text>
                {venueName && <Text style={fs.venueChip}>{venueName.toUpperCase()}</Text>}
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              {/* Confidence ring hero */}
              <LinearGradient colors={['#1A0A1A', '#0D0A1F']} style={fs.heroCard}>
                <ConfidenceRing confidence={prediction.confidence} color={cColor} />
                <Text style={[fs.heroHeadline, { color: '#FFF' }]}>{prediction.headline}</Text>
              </LinearGradient>

              {/* Trajectory card */}
              <View style={[fs.trajectoryCard, { borderColor: tColor + '40', backgroundColor: tColor + '0C' }]}>
                <View style={fs.trajectoryRow}>
                  <Ionicons name={tIcon as any} size={28} color={tColor} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[fs.trajectoryTitle, { color: tColor }]}>
                      {trajectory.charAt(0).toUpperCase() + trajectory.slice(1)}
                    </Text>
                    <Text style={fs.trajectoryDesc}>{TRAJECTORY_DESC[trajectory]}</Text>
                  </View>
                </View>
              </View>

              {/* Timing block */}
              <View style={fs.timingBlock}>
                <View style={fs.timingItem}>
                  <Ionicons name="time-outline" size={16} color="#FFD700" />
                  <Text style={fs.timingLabel}>Best arrival</Text>
                  <Text style={fs.timingValue}>{prediction.best_arrival}</Text>
                </View>
                {prediction.peak_window_start && (
                  <View style={[fs.timingItem, { borderLeftWidth: 1, borderLeftColor: '#1A1A28', paddingLeft: 16 }]}>
                    <Ionicons name="flash" size={16} color={tColor} />
                    <Text style={fs.timingLabel}>Peak window</Text>
                    <Text style={[fs.timingValue, { color: tColor }]}>
                      {prediction.peak_window_start} – {prediction.peak_window_end}
                    </Text>
                  </View>
                )}
              </View>

              {/* Signals */}
              <View style={fs.section}>
                <Text style={fs.sectionLabel}>INTEL SIGNALS</Text>
                {renderSignals(true)}
              </View>

              {/* Premium */}
              <View style={fs.section}>
                <Text style={fs.sectionLabel}>AI ANALYSIS</Text>
                {renderPremium(true)}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <VibePlusModal
        visible={showVibePlus}
        onClose={() => setShowVibePlus(false)}
        onSuccess={() => { setShowVibePlus(false); fetchPremium(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  loadingContainer: {
    marginHorizontal: 16, marginTop: 12,
    height: 48, justifyContent: 'center', alignItems: 'center',
  },
  container: { flexDirection: 'row' },
  accentBar: { width: 4 },
  content: { flex: 1, padding: 14, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  oracleLabel: { color: '#FFD700', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceText: { fontSize: 10, fontWeight: '700' },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  headline: { color: '#FFF', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrivalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  arrivalText: { color: '#999', fontSize: 12 },
  trajectoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  trajectoryText: { fontSize: 10, fontWeight: '600' },
  signalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  signalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  signalEmoji: { fontSize: 12 },
  signalLabel: { color: '#CCC', fontSize: 11, fontWeight: '500' },
  premiumCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 4, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  premiumCTAText: { color: '#FFD700', fontSize: 13, fontWeight: '700' },
  premiumCTABadge: { backgroundColor: 'rgba(153,51,255,0.25)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  premiumCTABadgeText: { color: '#CC88FF', fontSize: 10, fontWeight: '700' },
  premiumUnlocked: { gap: 8 },
  premiumDivider: { height: 1, backgroundColor: 'rgba(255,215,0,0.15)', marginVertical: 2 },
  premiumRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  premiumRowLabel: { color: '#FFD700', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  premiumRowValue: { color: '#CCC', fontSize: 12, flex: 1, textAlign: 'right' },
  insiderTipBox: {
    backgroundColor: 'rgba(153,51,255,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(153,51,255,0.25)', padding: 10, gap: 5,
  },
  insiderTipHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  insiderTipTitle: { color: '#CC88FF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  insiderTipText: { color: '#DDD', fontSize: 12, lineHeight: 17 },
  claudeBadge: {
    alignSelf: 'flex-end', backgroundColor: 'rgba(153,51,255,0.18)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(153,51,255,0.3)',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  claudeBadgeText: { color: '#BB88FF', fontSize: 10, fontWeight: '700' },
});

const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  venueChip: {
    fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 2,
    backgroundColor: '#1A1A28', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { paddingBottom: 48 },
  heroCard: {
    margin: 16, borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)', padding: 24,
    alignItems: 'center', gap: 16,
  },
  heroHeadline: { fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 26, paddingHorizontal: 8 },
  trajectoryCard: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  trajectoryRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  trajectoryTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  trajectoryDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
  timingBlock: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14,
    borderWidth: 1, borderColor: '#1A1A28', padding: 16, gap: 16,
  },
  timingItem: { flex: 1, gap: 4 },
  timingLabel: { fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 1.5 },
  timingValue: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  signalChipBig: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
});
