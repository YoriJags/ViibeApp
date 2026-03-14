/**
 * PUBLIC FLOOR - Crew (Viibez Cartel)
 * First-class tab. Premium dark glass design to match the Explore/Intel aesthetic.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../../src/store/vibeStore';
import VoteCard from '../../src/components/VoteCard';
import AvatarDisplay from '../../src/components/AvatarDisplay';
import CartelRadarMap from '../../src/components/CartelRadarMap';
import CartelPulse from '../../src/components/CartelPulse';
import CartelBattle from '../../src/components/CartelBattle';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import { OwnBatteryIndicator } from '../../src/components/BatteryIndicator';
import CrewIntelligence from '../../src/components/CrewIntelligence';
import RollingDeepBanner from '../../src/components/RollingDeepBanner';

export default function CrewScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const radarY = useRef(0);
  const user = useVibeStore(s => s.user);
  const crew = useVibeStore(s => s.crew);
  const isDemoMode = useVibeStore(s => s.isDemoMode);
  const activeVote = useVibeStore(s => s.activeVote);
  const lobbyVenues = useVibeStore(s => s.lobbyVenues);
  const fetchCrew = useVibeStore(s => s.fetchCrew);
  const createCrew = useVibeStore(s => s.createCrew);
  const joinCrew = useVibeStore(s => s.joinCrew);
  const leaveCrew = useVibeStore(s => s.leaveCrew);
  const startVote = useVibeStore(s => s.startVote);
  const castVote = useVibeStore(s => s.castVote);
  const fetchLobby = useVibeStore(s => s.fetchLobby);

  const [crewName, setCrewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVotePicker, setShowVotePicker] = useState(false);
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [codeCopied, setCodeCopied] = useState(false);
  const [myNightPlan, setMyNightPlan] = useState<'out' | 'maybe' | 'skip' | null>(null);
  const [showCrewIntel, setShowCrewIntel] = useState(false);

  useEffect(() => {
    fetchCrew();
    fetchLobby();
  }, []);

  const handleCreate = async () => {
    if (crewName.length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await createCrew(crewName);
      setCrewName('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (inviteCode.length < 6) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await joinCrew(inviteCode);
      setInviteCode('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const handleLeave = () => {
    if (!crew) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Leave Cartel',
      crew.is_captain
        ? 'As captain, leaving will dissolve the Cartel. Are you sure?'
        : 'Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveCrew(crew.id) },
      ]
    );
  };

  const handleCopyCode = () => {
    if (!crew) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(crew.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleStartVote = async () => {
    if (!crew || selectedVenueIds.length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await startVote(crew.id, selectedVenueIds);
      setShowVotePicker(false);
      setSelectedVenueIds([]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const handleCastVote = async (venueId: string) => {
    if (!crew || !activeVote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await castVote(crew.id, activeVote.id, venueId);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const toggleVenueSelection = (venueId: string) => {
    Haptics.selectionAsync();
    setSelectedVenueIds(prev =>
      prev.includes(venueId)
        ? prev.filter(id => id !== venueId)
        : prev.length < 4 ? [...prev, venueId] : prev
    );
  };

  const liveMembers = crew?.member_details?.filter((m: any) => m.checked_in) ?? [];

  // ── NO CREW: create / join ────────────────────────────────────────────────
  if (!crew) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>CARTEL</Text>
              <Text style={styles.headerSub}>Your crew. Your moves.</Text>
            </View>
            <OwnBatteryIndicator size="md" />
          </View>

          {/* Hero graphic */}
          <LinearGradient
            colors={['#1A0A2E', '#110822', '#0A0A0F']}
            style={styles.heroCard}
          >
            <View style={styles.heroGlow} />

            {/* 6-person unity icon */}
            <View style={styles.heroIconRing}>
              <LinearGradient colors={['#9933FF', '#FF3366']} style={styles.heroIconGrad}>
                {[
                  { angle: 0,   color: '#FF3366' },
                  { angle: 60,  color: '#9933FF' },
                  { angle: 120, color: '#FF9933' },
                  { angle: 180, color: '#3399FF' },
                  { angle: 240, color: '#00E676' },
                  { angle: 300, color: '#FFD700' },
                ].map(({ angle, color }, i) => {
                  const rad = (angle * Math.PI) / 180;
                  const x = 33 + 18 * Math.sin(rad);
                  const y = 33 - 18 * Math.cos(rad);
                  return (
                    <View key={i} style={[styles.handNode, { left: x - 7, top: y - 7, backgroundColor: color + '33', borderColor: color + '88' }]}>
                      <Ionicons name="person" size={8} color={color} />
                    </View>
                  );
                })}
                <View style={styles.handCenter} />
              </LinearGradient>
            </View>

            <Text style={styles.heroTitle}>Build Your Cartel</Text>
            <Text style={styles.heroBody}>
              Move as a unit. Vote on where to go, track your squad live, and earn bonus clout for rolling deep.
            </Text>

            <View style={styles.heroStats}>
              {[
                { icon: 'location', label: 'Live tracking' },
                { icon: 'hand-left', label: 'Group votes' },
                { icon: 'flash', label: 'Clout boost' },
              ].map(s => (
                <View key={s.label} style={styles.heroStat}>
                  <Ionicons name={s.icon as any} size={16} color="#9933FF" />
                  <Text style={styles.heroStatText}>{s.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* Create */}
          <View style={styles.formSection}>
            <View style={styles.formLabelRow}>
              <View style={styles.formDot} />
              <Text style={styles.formLabel}>CREATE A CARTEL</Text>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="shield" size={16} color="#555" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Cartel name (max 20 chars)"
                placeholderTextColor="#444"
                value={crewName}
                onChangeText={(t) => setCrewName(t.slice(0, 20))}
              />
              <Text style={styles.inputCounter}>{crewName.length}/20</Text>
            </View>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={crewName.length < 2 || loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={crewName.length >= 2 ? ['#9933FF', '#FF3366'] : ['#1E1E2A', '#1E1E2A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                <Text style={[styles.ctaBtnText, crewName.length < 2 && { color: '#444' }]}>
                  {loading ? 'Creating...' : 'Found Cartel'}
                </Text>
                {crewName.length >= 2 && <Ionicons name="shield-checkmark" size={16} color="#FFF" />}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Join */}
          <View style={styles.formSection}>
            <View style={styles.formLabelRow}>
              <View style={[styles.formDot, { backgroundColor: '#FF3366' }]} />
              <Text style={styles.formLabel}>JOIN A CARTEL</Text>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="key" size={16} color="#555" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { letterSpacing: 4, fontWeight: '800' }]}
                placeholder="6-CHAR CODE"
                placeholderTextColor="#444"
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase().slice(0, 6))}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>
            <TouchableOpacity
              onPress={handleJoin}
              disabled={inviteCode.length < 6 || loading}
              activeOpacity={0.8}
              style={[styles.joinBtn, inviteCode.length < 6 && { opacity: 0.4 }]}
            >
              <Text style={styles.joinBtnText}>
                {loading ? 'Joining...' : 'Join Cartel'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FF3366" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── HAS CREW: dashboard ──────────────────────────────────────────────────
  const checkedInCount = liveMembers.length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header — crew name + leave */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{crew.name.toUpperCase()}</Text>
            <Text style={styles.headerSub}>
              {crew.members.length}/8 members
              {checkedInCount > 0 && ` · ${checkedInCount} out tonight`}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLeave} style={styles.leaveBtn}>
            <Ionicons name="exit-outline" size={16} color="#FF5252" />
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Cartel Pulse — live crew activity */}
        <CartelPulse
          cartelName={crew.name}
          members={(crew.member_details ?? []) as any[]}
          onPress={() => scrollRef.current?.scrollTo({ y: radarY.current, animated: true })}
        />

        {/* Cartel Battle — cross-venue tap-off */}
        <ErrorBoundary label="Cartel Battle">
          <CartelBattle
            crewId={crew.id}
            crewName={crew.name}
            isCaptain={crew.is_captain ?? false}
            isDemoMode={isDemoMode}
          />
        </ErrorBoundary>

        {/* Rolling Deep — group check-in coordination banner */}
        <ErrorBoundary label="Rolling Deep">
          <RollingDeepBanner
            crewId={crew.id}
            currentUserId={user?.id ?? ''}
            isDemoMode={isDemoMode}
            onVenuePress={(id) => router.push(`/venue/${id}` as any)}
          />
        </ErrorBoundary>

        {/* AI Cartel Intel button */}
        <TouchableOpacity
          style={styles.intelBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCrewIntel(true); }}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#1A0A2E', '#120A24']} style={styles.intelBtnGrad}>
            <Ionicons name="sparkles" size={16} color="#9933FF" />
            <View style={styles.intelBtnText}>
              <Text style={styles.intelBtnTitle}>CARTEL INTEL</Text>
              <Text style={styles.intelBtnSub}>AI picks for your squad tonight</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#9933FF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Night Confirmed — squad readiness */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: '#FF9933' }]} />
            <Text style={styles.sectionLabel}>TONIGHT'S PLANS</Text>
          </View>

          {/* My status */}
          <View style={styles.nightPlanRow}>
            {([
              { key: 'out',   label: "I'm Out",  icon: 'checkmark-circle', color: '#00E676' },
              { key: 'maybe', label: 'Maybe',     icon: 'help-circle',      color: '#FF9933' },
              { key: 'skip',  label: 'Staying In',icon: 'close-circle',     color: '#555'    },
            ] as const).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.nightPlanBtn, myNightPlan === opt.key && { borderColor: opt.color, backgroundColor: opt.color + '18' }]}
                onPress={() => { Haptics.selectionAsync(); setMyNightPlan(opt.key); }}
                activeOpacity={0.8}
              >
                <Ionicons name={opt.icon} size={16} color={myNightPlan === opt.key ? opt.color : '#444'} />
                <Text style={[styles.nightPlanBtnText, myNightPlan === opt.key && { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Squad readiness bar */}
          {myNightPlan && (
            <View style={styles.readinessWrap}>
              <View style={styles.readinessBar}>
                <View style={[styles.readinessFill, { width: `${myNightPlan === 'out' ? 100 : myNightPlan === 'maybe' ? 50 : 10}%` as any, backgroundColor: myNightPlan === 'out' ? '#00E676' : myNightPlan === 'maybe' ? '#FF9933' : '#333' }]} />
              </View>
              <Text style={styles.readinessText}>
                {myNightPlan === 'out' ? 'You\'re locked in 🔥' : myNightPlan === 'maybe' ? 'Keeping options open' : 'Sitting this one out'}
              </Text>
            </View>
          )}
        </View>

        {/* Invite code card */}
        <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.8}>
          <LinearGradient
            colors={['#1A0A2E', '#110A22']}
            style={styles.codeCard}
          >
            <View style={styles.codeLabelRow}>
              <View style={styles.codeLiveDot} />
              <Text style={styles.codeCardLabel}>INVITE CODE</Text>
            </View>
            <Text style={styles.codeValue}>{crew.invite_code}</Text>
            <View style={styles.codeCopyRow}>
              <Ionicons
                name={codeCopied ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={codeCopied ? '#00E676' : '#555'}
              />
              <Text style={[styles.codeCopyText, codeCopied && { color: '#00E676' }]}>
                {codeCopied ? 'Copied!' : 'Tap to copy · Share with friends'}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionLabel}>MEMBERS</Text>
          </View>

          {(crew.member_details ?? []).map((member: any) => {
            const isLive = member.checked_in;
            const isCaptain = member.user_id === crew.captain_id;
            return (
              <View key={member.user_id} style={[styles.memberCard, isLive && styles.memberCardLive]}>
                <AvatarDisplay
                  config={member.avatar_config || null}
                  username={member.username}
                  size={40}
                  showBorder={isLive}
                  borderColor="#00E676"
                />
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{member.username}</Text>
                    {isCaptain && (
                      <View style={styles.captainBadge}>
                        <Text style={styles.captainBadgeText}>CAPTAIN</Text>
                      </View>
                    )}
                  </View>
                  {isLive && member.venue_name ? (
                    <Text style={styles.memberVenue}>📍 {member.venue_name}</Text>
                  ) : (
                    <Text style={styles.memberOffline}>Not out yet</Text>
                  )}
                </View>
                {isLive && <View style={styles.livePulse} />}
              </View>
            );
          })}
        </View>

        {/* Cartel Radar */}
        <View style={styles.section} onLayout={(e) => { radarY.current = e.nativeEvent.layout.y; }}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: '#00E676' }]} />
            <Text style={styles.sectionLabel}>CARTEL RADAR</Text>
            <Text style={styles.sectionSub}> · live squad positions</Text>
          </View>
          <View style={styles.radarWrap}>
            <ErrorBoundary label="Radar">
              <CartelRadarMap
                crewId={crew.id}
                crewSize={crew.members?.length || crew.member_details?.length || 1}
                height={260}
              />
            </ErrorBoundary>
          </View>
        </View>

        {/* Active Vote */}
        {activeVote && user && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View style={[styles.sectionDot, { backgroundColor: '#FF9933' }]} />
              <Text style={styles.sectionLabel}>ACTIVE VOTE</Text>
            </View>
            <VoteCard
              options={(activeVote.options ?? []) as any}
              totalVotes={activeVote.total_votes ?? 0}
              hasVoted={activeVote.has_voted || false}
              userId={user.id}
              onVote={handleCastVote}
              winner={(activeVote.status === 'completed' ? activeVote.winner : null) as any}
            />
          </View>
        )}

        {/* Start Vote — captain only, no active vote */}
        {crew.is_captain && !activeVote && (
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View style={[styles.sectionDot, { backgroundColor: '#FF3366' }]} />
              <Text style={styles.sectionLabel}>CARTEL VOTE</Text>
            </View>

            {!showVotePicker ? (
              <TouchableOpacity
                style={styles.startVoteBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowVotePicker(true); }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF336615', '#9933FF15']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startVoteBtnInner}
                >
                  <Ionicons name="hand-left" size={18} color="#FF3366" />
                  <Text style={styles.startVoteBtnText}>Start a Venue Vote</Text>
                  <Ionicons name="chevron-forward" size={14} color="#555" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.pickerHint}>
                  Pick 2–4 venues to vote on ({selectedVenueIds.length} selected)
                </Text>
                {lobbyVenues.map((venue) => {
                  const selected = selectedVenueIds.includes(venue.id);
                  return (
                    <TouchableOpacity
                      key={venue.id}
                      style={[styles.venuePickRow, selected && styles.venuePickSelected]}
                      onPress={() => toggleVenueSelection(venue.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.venuePickName}>{venue.name}</Text>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={selected ? '#FF3366' : '#333'}
                      />
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={handleStartVote}
                  disabled={selectedVenueIds.length < 2 || loading}
                  activeOpacity={0.8}
                  style={{ marginTop: 10 }}
                >
                  <LinearGradient
                    colors={selectedVenueIds.length >= 2 ? ['#FF3366', '#9933FF'] : ['#1E1E2A', '#1E1E2A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaBtn}
                  >
                    <Text style={[styles.ctaBtnText, selectedVenueIds.length < 2 && { color: '#444' }]}>
                      {loading ? 'Starting...' : 'Launch Vote'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <CrewIntelligence
        visible={showCrewIntel}
        onClose={() => setShowCrewIntel(false)}
        crewName={crew.name}
        memberPersonas={(crew.member_details ?? []).map((m: any) => m.persona ?? 'turn_up')}
        isDemoMode={isDemoMode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { paddingHorizontal: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  headerSub: { fontSize: 11, color: '#555', marginTop: 2, fontWeight: '500' },

  // 6-person unity icon
  handNode: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handCenter: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    top: 29,
    left: 29,
  },

  // Hero (no crew)
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9933FF22',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#9933FF18',
  },
  heroIconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: '#9933FF44',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#9933FF',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  heroIconGrad: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: -0.3, marginBottom: 10 },
  heroBody: { fontSize: 13, color: '#777', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  heroStats: { flexDirection: 'row', gap: 20 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroStatText: { fontSize: 11, color: '#555', fontWeight: '600' },

  // Form section
  formSection: { marginBottom: 20 },
  formLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  formDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#9933FF' },
  formLabel: { fontSize: 9, fontWeight: '800', color: '#555', letterSpacing: 1.5 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E0E18',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E2A',
    paddingHorizontal: 14,
    marginBottom: 12,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#EEE', fontWeight: '600' },
  inputCounter: { fontSize: 10, color: '#333', fontWeight: '600' },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF336633',
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: '#FF33660A',
  },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: '#FF3366' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#111' },
  dividerText: { fontSize: 12, color: '#333', fontWeight: '600' },

  // Invite code
  codeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9933FF22',
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  codeLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9933FF' },
  codeCardLabel: { fontSize: 9, fontWeight: '800', color: '#666', letterSpacing: 1.5 },
  codeValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 10,
    marginBottom: 12,
    textShadowColor: '#9933FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  codeCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  codeCopyText: { fontSize: 11, color: '#444', fontWeight: '500' },

  // Leave btn
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#FF525222',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  leaveBtnText: { fontSize: 11, color: '#FF5252', fontWeight: '700' },

  // Night Confirmed
  nightPlanRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  nightPlanBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1, borderColor: '#1E1E2A', backgroundColor: '#0D0D16',
  },
  nightPlanBtnText: { fontSize: 11, fontWeight: '700', color: '#444' },
  readinessWrap: { gap: 8 },
  readinessBar: { height: 3, backgroundColor: '#111', borderRadius: 2 },
  readinessFill: { height: 3, borderRadius: 2 },
  readinessText: { fontSize: 11, color: '#555', fontWeight: '500' },

  // Section
  section: { marginBottom: 24 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#9933FF' },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: '#555', letterSpacing: 1.5 },
  sectionSub: { fontSize: 9, color: '#333', fontWeight: '600' },

  // Member cards
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0D0D16',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A24',
  },
  memberCardLive: {
    borderColor: '#00E67622',
    backgroundColor: '#00E6760A',
  },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  memberName: { fontSize: 14, fontWeight: '700', color: '#DDD' },
  captainBadge: {
    backgroundColor: '#FF336618',
    borderWidth: 1,
    borderColor: '#FF336633',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  captainBadgeText: { fontSize: 8, fontWeight: '800', color: '#FF3366', letterSpacing: 1 },
  memberVenue: { fontSize: 11, color: '#00E676', fontWeight: '500' },
  memberOffline: { fontSize: 11, color: '#333', fontWeight: '500' },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
    shadowColor: '#00E676',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  // Radar
  radarWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1A1A24',
  },

  // Vote
  startVoteBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FF336622',
  },
  startVoteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
  },
  startVoteBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#CCC' },
  pickerHint: { fontSize: 11, color: '#555', marginBottom: 12, fontWeight: '600' },
  venuePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0D16',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A24',
  },
  venuePickSelected: { borderColor: '#FF336655', backgroundColor: '#FF33660A' },
  venuePickName: { fontSize: 14, fontWeight: '600', color: '#CCC' },

  // Cartel Intel button
  intelBtn: { marginBottom: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#9933FF33' },
  intelBtnGrad: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 18, gap: 12,
  },
  intelBtnText: { flex: 1 },
  intelBtnTitle: { fontSize: 12, fontWeight: '900', color: '#9933FF', letterSpacing: 1.5 },
  intelBtnSub: { fontSize: 11, color: '#555', fontWeight: '500', marginTop: 1 },
});
