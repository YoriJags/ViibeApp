/**
 * CartelBattle — Cross-venue tap-off between two cartels.
 *
 * Captain issues a challenge to another cartel by invite code.
 * All members tap for their side. Rate-limited to 1 tap per 5 seconds.
 * 30-minute battle. Winner crew earns bragging rights + clout bonus.
 *
 * States:
 *   no battle  → "CHALLENGE" CTA for captain, "No active battle" for members
 *   pending    → challenger sees "Waiting for acceptance", opponent sees "Accept" button
 *   active     → live tap arena with real-time taps & countdown
 *   ended      → result card showing winner/loser/tie
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Modal, TextInput, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const { height: SCREEN_H } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface BattleSide {
  id: string;
  name: string;
  venue_name: string;
  taps: number;
  share: number;
}

interface CartelBattleData {
  id: string;
  status: 'pending' | 'active' | 'ended';
  seconds_left: number | null;
  crew_a: BattleSide;
  crew_b: BattleSide;
  total_taps: number;
  winner: 'a' | 'b' | 'tie' | null;
}

interface Props {
  crewId: string;
  crewName: string;
  isCaptain: boolean;
  isDemoMode?: boolean;
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_BATTLE: CartelBattleData = {
  id: 'demo-battle-1',
  status: 'active',
  seconds_left: 912,
  crew_a: { id: 'c1', name: 'Night Wolves', venue_name: 'DNA Nightclub', taps: 47, share: 61 },
  crew_b: { id: 'c2', name: 'Vibez Cartel', venue_name: 'Club Quilox', taps: 30, share: 39 },
  total_taps: 77,
  winner: null,
};

export default function CartelBattle({ crewId, crewName, isCaptain, isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);

  const [battle, setBattle] = useState<CartelBattleData | null>(null);
  const [mySide, setMySide] = useState<'a' | 'b' | null>(null);
  const [loading, setLoading] = useState(true);
  const [tapping, setTapping] = useState(false);
  const [tapCooldown, setTapCooldown] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showChallenge, setShowChallenge] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [challenging, setChallenging] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Animations
  const myPulse  = useRef(new Animated.Value(1)).current;
  const oppPulse = useRef(new Animated.Value(1)).current;
  const barAnim  = useRef(new Animated.Value(0.5)).current;

  // Cooldown ticker
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBattle = useCallback(async () => {
    if (isDemoMode) {
      setBattle(DEMO_BATTLE);
      setMySide('a');
      setTimeLeft(DEMO_BATTLE.seconds_left ?? 0);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/cartel-battles/active`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setBattle(d.battle);
        setMySide(d.my_side ?? null);
        if (d.battle?.seconds_left) setTimeLeft(d.battle.seconds_left);
      }
    } catch {}
    setLoading(false);
  }, [isDemoMode, getAuthHeaders]);

  // Initial load + poll every 8 seconds
  useEffect(() => {
    fetchBattle();
    const interval = setInterval(fetchBattle, 8_000);
    return () => clearInterval(interval);
  }, [fetchBattle]);

  // Countdown timer
  useEffect(() => {
    if (battle?.status !== 'active' || !battle.seconds_left) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); fetchBattle(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [battle?.id, battle?.status]);

  // Bar animation on share change
  useEffect(() => {
    if (!battle) return;
    const shareA = (mySide === 'a' ? battle.crew_a.share : battle.crew_b.share) / 100;
    Animated.spring(barAnim, { toValue: shareA, tension: 50, friction: 12, useNativeDriver: false }).start();
  }, [battle?.crew_a.taps, battle?.crew_b.taps, mySide]);

  const tapPulseAnim = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.14, duration: 100, useNativeDriver: true }),
      Animated.spring(anim,  { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const handleTap = async () => {
    if (!battle || tapping || tapCooldown > 0) return;
    if (isDemoMode) {
      tapPulseAnim(myPulse);
      setBattle(b => b ? {
        ...b,
        crew_a: { ...b.crew_a, taps: b.crew_a.taps + 1 },
        total_taps: b.total_taps + 1,
      } : b);
      startCooldown();
      return;
    }
    setTapping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    tapPulseAnim(myPulse);
    try {
      const res = await fetch(`${API_URL}/api/cartel-battles/${battle.id}/tap`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const d = await res.json();
      if (res.ok) {
        setBattle(d.battle);
        setMySide(d.my_side);
        startCooldown();
      } else if (res.status === 429) {
        startCooldown();
      } else {
        Alert.alert('Error', d.detail || 'Tap failed');
      }
    } catch {}
    setTapping(false);
  };

  const startCooldown = () => {
    setTapCooldown(5);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setTapCooldown(c => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleChallenge = async () => {
    const code = inviteInput.trim().toUpperCase();
    if (code.length < 4) { Alert.alert('Enter the enemy cartel\'s invite code'); return; }
    setChallenging(true);
    try {
      const res = await fetch(`${API_URL}/api/cartel-battles/challenge`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code }),
      });
      const d = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBattle(d.battle);
        setMySide('a');
        setShowChallenge(false);
        setInviteInput('');
      } else {
        Alert.alert('Challenge failed', d.detail || 'Unknown error');
      }
    } catch { Alert.alert('Network error'); }
    setChallenging(false);
  };

  const handleAccept = async () => {
    if (!battle) return;
    setAccepting(true);
    try {
      const res = await fetch(`${API_URL}/api/cartel-battles/${battle.id}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const d = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBattle(d.battle);
      } else {
        Alert.alert('Error', d.detail);
      }
    } catch {}
    setAccepting(false);
  };

  if (loading) return (
    <View style={styles.loadingCard}><ActivityIndicator size="small" color="#FF3366" /></View>
  );

  // ── No active battle ────────────────────────────────────────────────────────
  if (!battle) {
    return (
      <>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="flash" size={13} color="#FF3366" />
              <Text style={styles.headerLabel}>CARTEL BATTLE</Text>
            </View>
          </View>
          <View style={styles.noBattleWrap}>
            <Text style={styles.noBattleText}>No active battle</Text>
            {isCaptain && (
              <TouchableOpacity
                style={styles.challengeBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowChallenge(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="flash" size={14} color="#FF3366" />
                <Text style={styles.challengeBtnText}>CHALLENGE A CARTEL</Text>
              </TouchableOpacity>
            )}
            {!isCaptain && (
              <Text style={styles.noBattleSub}>Your captain can issue a challenge</Text>
            )}
          </View>
        </View>

        <ChallengeModal
          visible={showChallenge}
          inviteInput={inviteInput}
          onChangeInput={setInviteInput}
          onChallenge={handleChallenge}
          onClose={() => { setShowChallenge(false); setInviteInput(''); }}
          loading={challenging}
        />
      </>
    );
  }

  const mySideData  = mySide === 'a' ? battle.crew_a : battle.crew_b;
  const oppSideData = mySide === 'a' ? battle.crew_b : battle.crew_a;
  const isEnded = battle.status === 'ended' || timeLeft === 0;
  const isPending = battle.status === 'pending';
  const iAmChallenged = isPending && mySide === 'b';

  const myTapShare = barAnim;
  const oppTapShare = barAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const winnerName =
    battle.winner === 'tie' ? 'TIE'
    : battle.winner === mySide ? `${mySideData.name} WINS 🏆`
    : `${oppSideData.name} WINS`;
  const winnerColor = battle.winner === mySide ? '#00E676' : battle.winner === 'tie' ? '#FFD700' : '#FF3366';

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="flash" size={13} color="#FF3366" />
            <Text style={styles.headerLabel}>CARTEL BATTLE</Text>
          </View>
          <View style={styles.headerRight}>
            {isPending ? (
              <View style={[styles.statusPill, { backgroundColor: '#FF990020', borderColor: '#FF990050' }]}>
                <Text style={[styles.statusText, { color: '#FF9900' }]}>PENDING</Text>
              </View>
            ) : isEnded ? (
              <View style={[styles.statusPill, { backgroundColor: '#00E67610', borderColor: '#00E67630' }]}>
                <Text style={[styles.statusText, { color: '#00E676' }]}>ENDED</Text>
              </View>
            ) : (
              <View style={[styles.statusPill, { backgroundColor: '#FF336610', borderColor: '#FF336630' }]}>
                <Ionicons name="time" size={10} color="#FF9933" />
                <Text style={[styles.statusText, { color: '#FF9933' }]}>{formatTime(timeLeft)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Pending: accept challenge */}
        {isPending && iAmChallenged && (
          <View style={styles.acceptWrap}>
            <Text style={styles.acceptTitle}>
              <Text style={{ color: '#FF3366' }}>{oppSideData.name}</Text> challenged you!
            </Text>
            <Text style={styles.acceptSub}>{oppSideData.venue_name} vs {mySideData.venue_name}</Text>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={handleAccept}
              disabled={accepting}
              activeOpacity={0.8}
            >
              {accepting ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="flash" size={14} color="#FFF" />
                  <Text style={styles.acceptBtnText}>ACCEPT BATTLE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isPending && !iAmChallenged && (
          <View style={styles.waitingWrap}>
            <ActivityIndicator size="small" color="#FF9933" />
            <Text style={styles.waitingText}>Waiting for {oppSideData.name} to accept…</Text>
          </View>
        )}

        {/* Active / Ended: arena */}
        {!isPending && (
          <>
            {/* Venue labels */}
            <View style={styles.venueRow}>
              <Text style={styles.venueLabel} numberOfLines={1}>{mySideData.venue_name}</Text>
              <Text style={styles.vsSmall}>VS</Text>
              <Text style={[styles.venueLabel, { textAlign: 'right' }]} numberOfLines={1}>{oppSideData.venue_name}</Text>
            </View>

            {/* Tap counts */}
            <View style={styles.tapsRow}>
              <Animated.View style={{ transform: [{ scale: myPulse }] }}>
                <TouchableOpacity
                  style={[
                    styles.tapBlock,
                    !isEnded && { borderColor: '#FF336688', backgroundColor: '#FF336610' },
                    isEnded && { borderColor: '#1A1A2A' },
                  ]}
                  onPress={handleTap}
                  disabled={isEnded || tapping || tapCooldown > 0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tapCount}>{mySideData.taps}</Text>
                  <Text style={styles.tapCrewName}>{mySideData.name}</Text>
                  {!isEnded && (
                    <View style={styles.tapCta}>
                      {tapCooldown > 0 ? (
                        <Text style={styles.cooldownText}>{tapCooldown}s</Text>
                      ) : (
                        <>
                          <Ionicons name="flash" size={11} color="#FF3366" />
                          <Text style={styles.tapCtaText}>TAP</Text>
                        </>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Text style={styles.vsText}>VS</Text>

              <Animated.View style={{ transform: [{ scale: oppPulse }] }}>
                <View style={[styles.tapBlock, { borderColor: '#1A1A2A', opacity: 0.7 }]}>
                  <Text style={styles.tapCount}>{oppSideData.taps}</Text>
                  <Text style={styles.tapCrewName}>{oppSideData.name}</Text>
                </View>
              </Animated.View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View style={[
                styles.progressFillMine,
                { width: myTapShare.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]} />
            </View>

            <View style={styles.shareRow}>
              <Text style={styles.shareText}>{mySideData.share}%</Text>
              <Text style={[styles.shareText, { textAlign: 'right', color: '#444' }]}>{oppSideData.share}%</Text>
            </View>

            {/* Result */}
            {isEnded && battle.winner && (
              <View style={[styles.resultBadge, { borderColor: winnerColor + '40', backgroundColor: winnerColor + '10' }]}>
                <Text style={[styles.resultText, { color: winnerColor }]}>{winnerName}</Text>
              </View>
            )}
          </>
        )}
      </View>

      <ChallengeModal
        visible={showChallenge}
        inviteInput={inviteInput}
        onChangeInput={setInviteInput}
        onChallenge={handleChallenge}
        onClose={() => { setShowChallenge(false); setInviteInput(''); }}
        loading={challenging}
      />
    </>
  );
}

// ── Challenge modal ────────────────────────────────────────────────────────────
function ChallengeModal({
  visible, inviteInput, onChangeInput, onChallenge, onClose, loading,
}: {
  visible: boolean;
  inviteInput: string;
  onChangeInput: (v: string) => void;
  onChallenge: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <LinearGradient colors={['#0A0015', '#060010']} style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={modal.title}>Challenge a Cartel</Text>
          <Text style={modal.sub}>Enter the enemy cartel's invite code. Your captain's check-in location will be used as your base.</Text>
          <TextInput
            style={modal.input}
            placeholder="INVITE CODE (e.g. ABC123)"
            placeholderTextColor="#333"
            value={inviteInput}
            onChangeText={v => onChangeInput(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
          <TouchableOpacity
            style={[modal.btn, loading && { opacity: 0.6 }]}
            onPress={onChallenge}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#FF3366', '#CC1144']} style={modal.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading
                ? <ActivityIndicator size="small" color="#FFF" />
                : <><Ionicons name="flash" size={15} color="#FFF" /><Text style={modal.btnText}>SEND CHALLENGE ⚡</Text></>
              }
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1,
    borderColor: '#1C1C2C', padding: 14, marginHorizontal: 16, marginTop: 12,
  },
  loadingCard: {
    marginHorizontal: 16, marginTop: 12, padding: 20, alignItems: 'center',
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 9, color: '#FF3366', fontWeight: '800', letterSpacing: 1.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  noBattleWrap: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  noBattleText: { fontSize: 13, color: '#333', fontWeight: '600' },
  noBattleSub: { fontSize: 11, color: '#222', textAlign: 'center' },
  challengeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#FF336640', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FF336610',
  },
  challengeBtnText: { fontSize: 12, fontWeight: '900', color: '#FF3366', letterSpacing: 1 },

  acceptWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  acceptTitle: { fontSize: 15, fontWeight: '800', color: '#EEE', textAlign: 'center' },
  acceptSub: { fontSize: 11, color: '#555', textAlign: 'center' },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FF3366', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 6,
  },
  acceptBtnText: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 1 },

  waitingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, justifyContent: 'center' },
  waitingText: { fontSize: 12, color: '#555', fontWeight: '600' },

  venueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 },
  venueLabel: { flex: 1, fontSize: 10, color: '#444', fontWeight: '600' },
  vsSmall: { fontSize: 10, color: '#222', fontWeight: '900' },

  tapsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  tapBlock: {
    flex: 1, borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', gap: 3,
  },
  tapCount: { fontSize: 32, fontWeight: '900', color: '#FFF', lineHeight: 36 },
  tapCrewName: { fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 0.8 },
  tapCta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  tapCtaText: { fontSize: 9, fontWeight: '900', color: '#FF3366', letterSpacing: 1.2 },
  cooldownText: { fontSize: 11, fontWeight: '800', color: '#333' },
  vsText: { fontSize: 18, fontWeight: '900', color: '#2A2A3E' },

  progressTrack: { height: 4, backgroundColor: '#0E0E1C', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFillMine: { height: 4, borderRadius: 2, backgroundColor: '#FF3366' },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shareText: { fontSize: 10, fontWeight: '800', color: '#FF3366' },

  resultBadge: {
    marginTop: 10, borderRadius: 10, borderWidth: 1,
    paddingVertical: 8, alignItems: 'center',
  },
  resultText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: 0.5, marginBottom: 6 },
  sub: { fontSize: 12, color: '#555', lineHeight: 18, marginBottom: 20 },
  input: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 3,
    marginBottom: 16, textAlign: 'center',
  },
  btn: { borderRadius: 14, overflow: 'hidden' },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  btnText: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
});
