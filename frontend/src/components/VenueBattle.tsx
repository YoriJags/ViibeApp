/**
 * VenueBattle — real-time tap-off between two venues.
 *
 * Two venues go head-to-head. Tap your side. Every bolt counts.
 * 30-minute window. One tap per scout per battle.
 * The crowd decides the winner.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const ENERGY_COLORS: Record<string, string> = {
  peak:    '#FF3366',
  lit:     '#FF8C00',
  charged: '#9933FF',
  warming: '#6655FF',
  chill:   '#3399FF',
  quiet:   '#3A3A4E',
};

interface BattleVenue {
  id: string;
  name: string;
  area: string;
  energy_level: string;
  vibe_score: number;
  taps: number;
  share: number;
}

interface Battle {
  id: string;
  status: 'active' | 'ended';
  seconds_left: number;
  venue_a: BattleVenue;
  venue_b: BattleVenue;
  total_taps: number;
  winner: 'a' | 'b' | 'tie' | null;
}

const DEMO_BATTLE: Battle = {
  id: 'demo1',
  status: 'active',
  seconds_left: 847,
  venue_a: { id: '1', name: 'DNA Nightclub', area: 'Victoria Island', energy_level: 'lit', vibe_score: 78, taps: 143, share: 62 },
  venue_b: { id: '2', name: 'Club Quilox',   area: 'Victoria Island', energy_level: 'charged', vibe_score: 65, taps: 87,  share: 38 },
  total_taps: 230,
  winner: null,
};

interface Props {
  isDemoMode?: boolean;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VenueBattle({ isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tapped, setTapped] = useState<'a' | 'b' | null>(null);
  const [tapping, setTapping] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const barAnim = useRef(new Animated.Value(0.5)).current;
  const pulseA  = useRef(new Animated.Value(1)).current;
  const pulseB  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isDemoMode) { setBattle(DEMO_BATTLE); setTimeLeft(DEMO_BATTLE.seconds_left); setLoading(false); return; }
    fetchBattle();
  }, [isDemoMode]);

  useEffect(() => {
    if (!battle) return;
    const shareA = battle.venue_a.share / 100;
    Animated.spring(barAnim, { toValue: shareA, tension: 50, friction: 12, useNativeDriver: false }).start();
  }, [battle?.venue_a.share]);

  // Countdown timer
  useEffect(() => {
    if (!battle || battle.status === 'ended') return;
    setTimeLeft(battle.seconds_left);
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); fetchBattle(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [battle?.id]);

  const fetchBattle = async () => {
    try {
      const res = await fetch(`${API_URL}/api/battles/active`);
      if (res.ok) {
        const d = await res.json();
        setBattle(d.battle);
        if (d.battle) setTimeLeft(d.battle.seconds_left);
      }
    } catch {}
    setLoading(false);
  };

  const tap = async (side: 'a' | 'b') => {
    if (tapped || tapping || !battle || isDemoMode) return;
    if (isDemoMode) { setTapped(side); return; }
    setTapping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const pulse = side === 'a' ? pulseA : pulseB;
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.15, duration: 120, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
    try {
      const res = await fetch(`${API_URL}/api/battles/${battle.id}/tap/${side}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setBattle(d.battle);
        setTapped(side);
      } else if (res.status === 429) {
        setTapped(side); // already tapped
      }
    } catch {}
    setTapping(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#FF3366" />
      </View>
    );
  }

  if (!battle) return null;

  const isEnded = battle.status === 'ended' || timeLeft === 0;
  const colorA = ENERGY_COLORS[battle.venue_a.energy_level] ?? '#FF3366';
  const colorB = ENERGY_COLORS[battle.venue_b.energy_level] ?? '#3399FF';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="flash" size={13} color="#FF3366" />
          <Text style={styles.headerLabel}>VENUE BATTLE</Text>
        </View>
        <View style={styles.timerPill}>
          <Ionicons name={isEnded ? 'checkmark-circle' : 'time'} size={11} color={isEnded ? '#00E676' : '#FF9933'} />
          <Text style={[styles.timerText, { color: isEnded ? '#00E676' : '#FF9933' }]}>
            {isEnded ? (battle.winner === 'tie' ? 'TIE' : battle.winner === 'a' ? battle.venue_a.name.split(' ')[0] + ' WINS' : battle.venue_b.name.split(' ')[0] + ' WINS') : formatTime(timeLeft)}
          </Text>
        </View>
      </View>

      {/* Battle arena */}
      <View style={styles.arenaRow}>
        {/* Venue A */}
        <Animated.View style={[styles.venueBlock, { transform: [{ scale: pulseA }] }]}>
          <TouchableOpacity
            style={[
              styles.venueTapBtn,
              { borderColor: colorA + '55', backgroundColor: colorA + '12' },
              tapped === 'a' && { borderColor: colorA, backgroundColor: colorA + '25' },
            ]}
            onPress={() => tap('a')}
            activeOpacity={0.7}
            disabled={!!tapped || isEnded}
          >
            <Text style={[styles.venueTapNum, { color: colorA }]}>{battle.venue_a.taps}</Text>
            <Ionicons name="flash" size={18} color={colorA} style={{ opacity: tapped === 'a' ? 1 : 0.5 }} />
          </TouchableOpacity>
          <Text style={styles.venueName} numberOfLines={2}>{battle.venue_a.name}</Text>
          <Text style={styles.venueArea}>{battle.venue_a.area}</Text>
          {tapped === 'a' && <Text style={[styles.votedBadge, { color: colorA }]}>YOUR PICK</Text>}
        </Animated.View>

        {/* VS */}
        <View style={styles.vsBlock}>
          <Text style={styles.vsText}>VS</Text>
          <Text style={styles.totalTaps}>{battle.total_taps} bolts</Text>
        </View>

        {/* Venue B */}
        <Animated.View style={[styles.venueBlock, { transform: [{ scale: pulseB }] }]}>
          <TouchableOpacity
            style={[
              styles.venueTapBtn,
              { borderColor: colorB + '55', backgroundColor: colorB + '12' },
              tapped === 'b' && { borderColor: colorB, backgroundColor: colorB + '25' },
            ]}
            onPress={() => tap('b')}
            activeOpacity={0.7}
            disabled={!!tapped || isEnded}
          >
            <Text style={[styles.venueTapNum, { color: colorB }]}>{battle.venue_b.taps}</Text>
            <Ionicons name="flash" size={18} color={colorB} style={{ opacity: tapped === 'b' ? 1 : 0.5 }} />
          </TouchableOpacity>
          <Text style={styles.venueName} numberOfLines={2}>{battle.venue_b.name}</Text>
          <Text style={styles.venueArea}>{battle.venue_b.area}</Text>
          {tapped === 'b' && <Text style={[styles.votedBadge, { color: colorB }]}>YOUR PICK</Text>}
        </Animated.View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[
          styles.progressFillA,
          {
            width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: colorA,
          },
        ]} />
      </View>

      <View style={styles.shareRow}>
        <Text style={[styles.shareText, { color: colorA }]}>{battle.venue_a.share}%</Text>
        <Text style={[styles.shareText, { color: colorB }]}>{battle.venue_b.share}%</Text>
      </View>

      {!tapped && !isEnded && (
        <Text style={styles.cta}>Tap a venue to cast your bolt</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0C15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1C1C2C',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  loadingCard: {
    marginHorizontal: 16, marginTop: 12, padding: 20,
    alignItems: 'center', backgroundColor: '#0C0C15',
    borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 9, color: '#FF3366', fontWeight: '800', letterSpacing: 1.5 },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#111120', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  timerText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  arenaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  venueBlock: { flex: 1, alignItems: 'center', gap: 6 },
  venueTapBtn: {
    width: '100%', borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', gap: 4,
  },
  venueTapNum: { fontSize: 26, fontWeight: '900', lineHeight: 28 },
  venueName: { fontSize: 11, fontWeight: '700', color: '#DDD', textAlign: 'center', lineHeight: 14 },
  venueArea: { fontSize: 9, color: '#444', fontWeight: '500', textAlign: 'center' },
  votedBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  vsBlock: { alignItems: 'center', gap: 4 },
  vsText: { fontSize: 16, fontWeight: '900', color: '#3A3A4E' },
  totalTaps: { fontSize: 8, color: '#2A2A4A', fontWeight: '600' },
  progressTrack: {
    height: 4, backgroundColor: '#0E0E1C', borderRadius: 2,
    overflow: 'hidden', marginBottom: 6,
  },
  progressFillA: { height: 4, borderRadius: 2 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shareText: { fontSize: 10, fontWeight: '800' },
  cta: { fontSize: 10, color: '#2A2A4A', fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
