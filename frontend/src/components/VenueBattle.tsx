/**
 * VenueBattle — real-time tap-off between two venues.
 *
 * Two venues go head-to-head. Tap your side. Every bolt counts.
 * 30-minute window. One tap per scout per battle.
 * Expand button opens fullscreen arena mode.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  ActivityIndicator, Modal, Dimensions,
} from 'react-native';


const { height: SCREEN_H } = Dimensions.get('window');
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

// ── Shared arena content ───────────────────────────────────────────────────────
function BattleArena({
  battle,
  tapped,
  tapping,
  timeLeft,
  colorA,
  colorB,
  barAnim,
  pulseA,
  pulseB,
  onTap,
  fullscreen = false,
}: {
  battle: Battle;
  tapped: 'a' | 'b' | null;
  timeLeft: number;
  colorA: string;
  colorB: string;
  barAnim: Animated.Value;
  pulseA: Animated.Value;
  pulseB: Animated.Value;
  onTap: (side: 'a' | 'b') => void;
  fullscreen?: boolean;
}) {
  const isEnded = battle.status === 'ended' || timeLeft === 0;

  return (
    <View style={fullscreen ? fs.arenaWrap : undefined}>
      {/* Arena row */}
      <View style={[styles.arenaRow, fullscreen && fs.arenaRow]}>
        {/* Venue A */}
        <Animated.View style={[styles.venueBlock, { transform: [{ scale: pulseA }] }]}>
          <TouchableOpacity
            style={[
              styles.venueTapBtn,
              fullscreen && fs.tapBtn,
              { borderColor: colorA + '55', backgroundColor: colorA + '12' },
              tapped === 'a' && { borderColor: colorA, backgroundColor: colorA + '25' },
            ]}
            onPress={() => onTap('a')}
            activeOpacity={0.7}
            disabled={!!tapped || isEnded}
          >
            <Text style={[styles.venueTapNum, fullscreen && fs.tapNum, { color: colorA }]}>{battle.venue_a.taps}</Text>
            <Ionicons name="flash" size={fullscreen ? 28 : 18} color={colorA} style={{ opacity: tapped === 'a' ? 1 : 0.5 }} />
            {!tapped && !isEnded && <Text style={[styles.tapHintText, { color: colorA + 'AA' }]}>TAP</Text>}
          </TouchableOpacity>
          <Text style={[styles.venueName, fullscreen && fs.venueName]} numberOfLines={2}>{battle.venue_a.name}</Text>
          <Text style={[styles.venueArea, fullscreen && fs.venueArea]}>{battle.venue_a.area}</Text>
          {tapped === 'a' && <Text style={[styles.votedBadge, { color: colorA }]}>YOUR PICK ⚡</Text>}
        </Animated.View>

        {/* VS block */}
        <View style={styles.vsBlock}>
          <Text style={[styles.vsText, fullscreen && fs.vsText]}>VS</Text>
          <Text style={[styles.totalTaps, fullscreen && { color: '#555', fontSize: 12 }]}>
            {battle.total_taps} bolts
          </Text>
          {isEnded && battle.winner && (
            <View style={fs.winnerBadge}>
              <Text style={fs.winnerText}>
                {battle.winner === 'tie' ? '🤝 TIE' : battle.winner === 'a' ? '🏆 A WINS' : '🏆 B WINS'}
              </Text>
            </View>
          )}
        </View>

        {/* Venue B */}
        <Animated.View style={[styles.venueBlock, { transform: [{ scale: pulseB }] }]}>
          <TouchableOpacity
            style={[
              styles.venueTapBtn,
              fullscreen && fs.tapBtn,
              { borderColor: colorB + '55', backgroundColor: colorB + '12' },
              tapped === 'b' && { borderColor: colorB, backgroundColor: colorB + '25' },
            ]}
            onPress={() => onTap('b')}
            activeOpacity={0.7}
            disabled={!!tapped || isEnded}
          >
            <Text style={[styles.venueTapNum, fullscreen && fs.tapNum, { color: colorB }]}>{battle.venue_b.taps}</Text>
            <Ionicons name="flash" size={fullscreen ? 28 : 18} color={colorB} style={{ opacity: tapped === 'b' ? 1 : 0.5 }} />
            {!tapped && !isEnded && <Text style={[styles.tapHintText, { color: colorB + 'AA' }]}>TAP</Text>}
          </TouchableOpacity>
          <Text style={[styles.venueName, fullscreen && fs.venueName]} numberOfLines={2}>{battle.venue_b.name}</Text>
          <Text style={[styles.venueArea, fullscreen && fs.venueArea]}>{battle.venue_b.area}</Text>
          {tapped === 'b' && <Text style={[styles.votedBadge, { color: colorB }]}>YOUR PICK ⚡</Text>}
        </Animated.View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, fullscreen && fs.progressTrack]}>
        <Animated.View style={[
          styles.progressFillA,
          {
            width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: colorA,
          },
        ]} />
      </View>

      <View style={styles.shareRow}>
        <Text style={[styles.shareText, fullscreen && fs.shareText, { color: colorA }]}>
          {battle.venue_a.name.split(' ')[0]} {battle.venue_a.share}%
        </Text>
        <Text style={[styles.shareText, fullscreen && fs.shareText, { color: colorB }]}>
          {battle.venue_b.share}% {battle.venue_b.name.split(' ')[0]}
        </Text>
      </View>

      {!tapped && !isEnded && (
        <Text style={[styles.cta, fullscreen && fs.cta]}>Tap a venue to cast your bolt ⚡</Text>
      )}
    </View>
  );
}

export default function VenueBattle({ isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tapped, setTapped] = useState<'a' | 'b' | null>(null);
  const [tapping, setTapping] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

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

  useEffect(() => {
    if (!battle || battle.status === 'ended') return;
    setTimeLeft(battle.seconds_left);
    const interval = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(interval); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [battle?.id]);

  useEffect(() => {
    if (timeLeft === 0 && battle && battle.status !== 'ended') fetchBattle();
  }, [timeLeft]);

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
    if (tapped || tapping || !battle) return;
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
        method: 'POST', headers: getAuthHeaders(),
      });
      if (res.ok) { const d = await res.json(); setBattle(d.battle); setTapped(side); }
      else if (res.status === 429) { setTapped(side); }
    } catch {}
    setTapping(false);
  };

  if (loading) return (
    <View style={styles.loadingCard}><ActivityIndicator size="small" color="#FF3366" /></View>
  );
  if (!battle) return null;

  const isEnded = battle.status === 'ended' || timeLeft === 0;
  const colorA = ENERGY_COLORS[battle.venue_a.energy_level] ?? '#FF3366';
  const colorB = ENERGY_COLORS[battle.venue_b.energy_level] ?? '#3399FF';

  const timerLabel = isEnded
    ? (battle.winner === 'tie' ? 'TIE' : battle.winner === 'a' ? battle.venue_a.name.split(' ')[0] + ' WINS' : battle.venue_b.name.split(' ')[0] + ' WINS')
    : formatTime(timeLeft);

  return (
    <>
      <View style={styles.container}>
        {/* Card header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="flash" size={13} color="#FF3366" />
            <Text style={styles.headerLabel}>VENUE BATTLE</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.timerPill}>
              <Ionicons name={isEnded ? 'checkmark-circle' : 'time'} size={11} color={isEnded ? '#00E676' : '#FF9933'} />
              <Text style={[styles.timerText, { color: isEnded ? '#00E676' : '#FF9933' }]}>{timerLabel}</Text>
            </View>
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFullscreen(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="expand-outline" size={15} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mini arena */}
        <BattleArena
          battle={battle} tapped={tapped} timeLeft={timeLeft}
          colorA={colorA} colorB={colorB} barAnim={barAnim} pulseA={pulseA} pulseB={pulseB}
          onTap={tap}
        />
      </View>

      {/* 82% bottom-sheet modal */}
      <Modal visible={fullscreen} transparent animationType="slide" onRequestClose={() => setFullscreen(false)}>
        <View style={fs.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setFullscreen(false)} activeOpacity={1} />
          <LinearGradient colors={['#0A0010', '#04000A', '#000010']} style={fs.sheet}>
            {/* Handle */}
            <View style={fs.handle} />
            {/* FS Header */}
            <View style={fs.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="flash" size={16} color="#FF3366" />
                <Text style={fs.headerLabel}>VENUE BATTLE</Text>
              </View>
              <View style={styles.headerRight}>
                <View style={styles.timerPill}>
                  <Ionicons name={isEnded ? 'checkmark-circle' : 'time'} size={12} color={isEnded ? '#00E676' : '#FF9933'} />
                  <Text style={[fs.timerText, { color: isEnded ? '#00E676' : '#FF9933' }]}>{timerLabel}</Text>
                </View>
                <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Full arena */}
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
              <BattleArena
                battle={battle} tapped={tapped} timeLeft={timeLeft}
                colorA={colorA} colorB={colorB} barAnim={barAnim} pulseA={pulseA} pulseB={pulseB}
                onTap={tap} fullscreen
              />
            </View>

            {/* Footer */}
            <View style={fs.footer}>
              <Text style={fs.footerText}>VIIBE BATTLE · City decides the winner · {battle.total_taps} total bolts cast</Text>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1,
    borderColor: '#1C1C2C', padding: 14, marginHorizontal: 16, marginTop: 12,
  },
  loadingCard: {
    marginHorizontal: 16, marginTop: 12, padding: 20, alignItems: 'center',
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLabel: { fontSize: 9, color: '#FF3366', fontWeight: '800', letterSpacing: 1.5 },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#111120', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  timerText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  arenaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  venueBlock: { flex: 1, alignItems: 'center', gap: 6 },
  venueTapBtn: {
    width: '100%', borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', gap: 4,
  },
  venueTapNum: { fontSize: 26, fontWeight: '900', lineHeight: 28 },
  tapHintText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 2 },
  venueName: { fontSize: 11, fontWeight: '700', color: '#DDD', textAlign: 'center', lineHeight: 14 },
  venueArea: { fontSize: 9, color: '#444', fontWeight: '500', textAlign: 'center' },
  votedBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  vsBlock: { alignItems: 'center', gap: 4 },
  vsText: { fontSize: 16, fontWeight: '900', color: '#3A3A4E' },
  totalTaps: { fontSize: 8, color: '#2A2A4A', fontWeight: '600' },
  progressTrack: { height: 4, backgroundColor: '#0E0E1C', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFillA: { height: 4, borderRadius: 2 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shareText: { fontSize: 10, fontWeight: '800' },
  cta: { fontSize: 10, color: '#2A2A4A', fontWeight: '600', textAlign: 'center', marginTop: 8 },
});

// Fullscreen-specific overrides
const fs = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  sheet: {
    height: SCREEN_H * 0.82,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,51,102,0.15)',
  },
  headerLabel: { fontSize: 14, color: '#FF3366', fontWeight: '900', letterSpacing: 2 },
  timerText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  arenaWrap: { paddingVertical: 20 },
  arenaRow: { gap: 16, marginBottom: 32 },
  tapBtn: { paddingVertical: 36, borderRadius: 20, borderWidth: 2 },
  tapNum: { fontSize: 48, lineHeight: 52 },
  venueName: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  venueArea: { fontSize: 11, color: '#555' },
  vsText: { fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  progressTrack: { height: 8, borderRadius: 4, marginBottom: 10, marginHorizontal: 0 },
  shareText: { fontSize: 14, fontWeight: '900' },
  cta: { fontSize: 14, color: '#444', textAlign: 'center', marginTop: 16, fontWeight: '600', letterSpacing: 0.5 },
  winnerBadge: {
    marginTop: 8, backgroundColor: 'rgba(0,230,118,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(0,230,118,0.3)',
  },
  winnerText: { fontSize: 11, fontWeight: '800', color: '#00E676', letterSpacing: 0.5 },
  footer: {
    paddingVertical: 16, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,51,102,0.1)',
  },
  footerText: { fontSize: 9, color: '#333', fontWeight: '700', letterSpacing: 1 },
});
