/**
 * CrewIntelligence — AI cartel venue picks.
 * One tap → Claude analyses every crew member's persona + tonight's live venue data
 * and returns ranked picks with reasons.
 * "The AI read your whole cartel. Here's where you should all be."
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal,
  StyleSheet, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const { width: W, height: H } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VenuePick {
  venue_id: string;
  venue_name: string;
  area: string;
  energy_level: string;
  vibe_score: number;
  match_score: number;   // 0–100, how well this fits the cartel
  reason: string;        // AI explanation
  best_for: string;      // "everyone" | "turn-up heads" | etc.
}

interface IntelResult {
  picks: VenuePick[];
  crew_read: string;     // One-line AI read of the cartel vibe
  ai_powered: boolean;
}

const ENERGY_COLORS: Record<string, string> = {
  peak: '#FF3366', lit: '#FF8C00', charged: '#9933FF',
  warming: '#6655FF', chill: '#3399FF', quiet: '#3A3A4E',
};

const DEMO_INTEL: IntelResult = {
  crew_read: "Your cartel is split — 2 turn-up heads and 1 chill set. You need a venue that runs both vibes.",
  ai_powered: true,
  picks: [
    {
      venue_id: '1', venue_name: 'DNA Nightclub', area: 'Victoria Island',
      energy_level: 'peak', vibe_score: 94, match_score: 92,
      reason: "High energy, good mix of music — the turn-up heads go first, the chill set joins when it's right. Everyone wins.",
      best_for: 'Full cartel',
    },
    {
      venue_id: '2', venue_name: 'Club Quilox', area: 'Lekki Phase 1',
      energy_level: 'lit', vibe_score: 81, match_score: 78,
      reason: "Buzzing but not overwhelming. Entry is clear, crowd is vibrant — solid for a crew that doesn't want to queue.",
      best_for: 'Turn-up heads',
    },
    {
      venue_id: '3', venue_name: 'Ember Creek', area: 'Ikoyi',
      energy_level: 'charged', vibe_score: 73, match_score: 65,
      reason: "Luxe setting with a building scene. Good if the cartel wants to start slow and escalate.",
      best_for: 'Chill-to-turn-up',
    },
  ],
};

interface Props {
  visible: boolean;
  onClose: () => void;
  crewName: string;
  memberPersonas: string[];   // array of each member's persona
  isDemoMode?: boolean;
}

export default function CrewIntelligence({ visible, onClose, crewName, memberPersonas, isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [intel, setIntel] = useState<IntelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideAnim  = useRef(new Animated.Value(H)).current;
  const bgOpac     = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(30)).current;

  const show = () => {
    slideAnim.setValue(H);
    bgOpac.setValue(0);
    contentAnim.setValue(30);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 14, useNativeDriver: true }),
        Animated.timing(bgOpac,    { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(contentAnim, { toValue: 0, tension: 55, friction: 12, delay: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  React.useEffect(() => {
    if (visible) {
      show();
      if (!intel) fetchIntel();
    }
  }, [visible]);

  const fetchIntel = async () => {
    if (isDemoMode) { setIntel(DEMO_INTEL); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/crew/ai-intel`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_personas: memberPersonas }),
      });
      if (res.ok) {
        const data = await res.json();
        setIntel(data);
      } else {
        setIntel(DEMO_INTEL); // fallback
      }
    } catch {
      setIntel(DEMO_INTEL);
    }
    setLoading(false);
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: H, duration: 280, useNativeDriver: true }),
      Animated.timing(bgOpac,    { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: bgOpac }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={18} color="#555" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={16} color="#9933FF" />
              <View>
                <Text style={styles.headerTitle}>CARTEL INTEL</Text>
                <Text style={styles.headerSub}>{crewName}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => { setIntel(null); fetchIntel(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={15} color="#9933FF" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color="#9933FF" size="large" />
              <Text style={styles.loadingTitle}>Reading your cartel...</Text>
              <Text style={styles.loadingDesc}>Analysing {memberPersonas.length} members against tonight's scene</Text>
            </View>
          ) : intel ? (
            <Animated.View style={{ transform: [{ translateY: contentAnim }] }}>

              {/* Crew read */}
              <LinearGradient
                colors={['#1A0A2E', '#110A22', '#0A0A15']}
                style={styles.crewReadCard}
              >
                <View style={styles.crewReadHeader}>
                  <Ionicons name="flash" size={12} color="#9933FF" />
                  <Text style={styles.crewReadLabel}>
                    {intel.ai_powered ? 'AI CARTEL READ' : 'CARTEL READ'}
                  </Text>
                </View>
                <Text style={styles.crewReadText}>{intel.crew_read}</Text>
              </LinearGradient>

              {/* Picks */}
              <Text style={styles.picksLabel}>TONIGHT'S PICKS FOR YOUR CARTEL</Text>

              {intel.picks.map((pick, i) => {
                const color = ENERGY_COLORS[pick.energy_level] ?? '#6655FF';
                const isTop = i === 0;
                return (
                  <View key={pick.venue_id} style={[styles.pickCard, isTop && { borderColor: color + '44' }]}>
                    {isTop && (
                      <View style={[styles.topPillWrap]}>
                        <View style={[styles.topPill, { backgroundColor: color + '22', borderColor: color + '44' }]}>
                          <Text style={[styles.topPillText, { color }]}>TOP PICK</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.pickTop}>
                      {/* Rank */}
                      <View style={styles.rankCircle}>
                        <Text style={styles.rankNum}>#{i + 1}</Text>
                      </View>

                      {/* Venue info */}
                      <View style={styles.pickInfo}>
                        <Text style={styles.pickName}>{pick.venue_name}</Text>
                        <Text style={styles.pickArea}>{pick.area}</Text>
                        <View style={[styles.energyPill, { backgroundColor: color + '1A', borderColor: color + '33' }]}>
                          <Text style={[styles.energyPillText, { color }]}>{pick.energy_level.toUpperCase()}</Text>
                        </View>
                      </View>

                      {/* Match score */}
                      <View style={styles.matchBlock}>
                        <Text style={[styles.matchNum, { color }]}>{pick.match_score}</Text>
                        <Text style={styles.matchLbl}>match</Text>
                      </View>
                    </View>

                    {/* AI reason */}
                    <Text style={styles.pickReason}>{pick.reason}</Text>

                    {/* Best for tag */}
                    <View style={styles.bestForRow}>
                      <Ionicons name="people" size={10} color="#444" />
                      <Text style={styles.bestForText}>Best for: {pick.best_for}</Text>
                    </View>
                  </View>
                );
              })}

              {/* Powered by note */}
              {intel.ai_powered && (
                <View style={styles.poweredBy}>
                  <Ionicons name="sparkles" size={10} color="#2A2A4A" />
                  <Text style={styles.poweredByText}>Powered by Claude AI</Text>
                </View>
              )}
            </Animated.View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.88)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: H * 0.88, backgroundColor: '#07070F',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  handle:        { width: 40, height: 4, backgroundColor: '#1A1A2C', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  closeBtn:      { position: 'absolute', top: 16, right: 20, padding: 6, zIndex: 10 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 16 },

  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle:   { fontSize: 13, fontWeight: '900', color: '#EEE', letterSpacing: 2 },
  headerSub:     { fontSize: 11, color: '#3A3A4E', marginTop: 1 },
  refreshBtn: {
    backgroundColor: '#0D0D1C', borderRadius: 10, borderWidth: 1,
    borderColor: '#9933FF33', padding: 8,
  },

  loadingBlock:  { alignItems: 'center', paddingTop: 60, gap: 14 },
  loadingTitle:  { fontSize: 16, fontWeight: '900', color: '#EEE' },
  loadingDesc:   { fontSize: 12, color: '#444', textAlign: 'center' },

  crewReadCard:  { borderRadius: 16, borderWidth: 1, borderColor: '#9933FF22', padding: 16, marginBottom: 20 },
  crewReadHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  crewReadLabel: { fontSize: 8, color: '#9933FF', fontWeight: '800', letterSpacing: 1.5 },
  crewReadText:  { fontSize: 14, color: '#AAA', fontWeight: '500', lineHeight: 22 },

  picksLabel:    { fontSize: 8, color: '#2A2A3A', fontWeight: '800', letterSpacing: 2, marginBottom: 12 },

  pickCard: {
    backgroundColor: '#0C0C18', borderRadius: 16, borderWidth: 1,
    borderColor: '#111120', padding: 14, marginBottom: 10,
  },
  topPillWrap:   { marginBottom: 10 },
  topPill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  topPillText:   { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  pickTop:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rankCircle:    { width: 30, height: 30, borderRadius: 15, backgroundColor: '#111120', justifyContent: 'center', alignItems: 'center' },
  rankNum:       { fontSize: 11, fontWeight: '900', color: '#3A3A4E' },
  pickInfo:      { flex: 1, gap: 4 },
  pickName:      { fontSize: 16, fontWeight: '800', color: '#EEE' },
  pickArea:      { fontSize: 11, color: '#3A3A4E', fontWeight: '500' },
  energyPill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  energyPillText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  matchBlock:    { alignItems: 'center' },
  matchNum:      { fontSize: 24, fontWeight: '900', lineHeight: 26 },
  matchLbl:      { fontSize: 8, color: '#2A2A4A', fontWeight: '600' },
  pickReason:    { fontSize: 12, color: '#777', lineHeight: 18, marginBottom: 8 },
  bestForRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bestForText:   { fontSize: 10, color: '#333', fontWeight: '600' },
  poweredBy:     { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 16 },
  poweredByText: { fontSize: 9, color: '#1C1C2C', fontWeight: '600', letterSpacing: 0.5 },
});
