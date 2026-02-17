/**
 * PUBLIC FLOOR - Crew Screen
 * Create/join a crew, view members, start venue votes.
 * Accessible from profile (not a tab).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { publicTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';
import VoteCard from '../../src/components/VoteCard';
import AvatarDisplay from '../../src/components/AvatarDisplay';

const { colors } = publicTheme;

export default function CrewScreen() {
  const router = useRouter();
  const {
    user,
    crew,
    activeVote,
    lobbyVenues,
    fetchCrew,
    createCrew,
    joinCrew,
    leaveCrew,
    startVote,
    castVote,
    fetchLobby,
  } = useVibeStore();

  const [crewName, setCrewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVotePicker, setShowVotePicker] = useState(false);
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);

  useEffect(() => {
    fetchCrew();
    fetchLobby();
  }, []);

  const handleCreate = async () => {
    if (crewName.length < 2) return;
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
    Alert.alert(
      'Leave Cartel',
      crew.is_captain
        ? 'As captain, leaving will dissolve the Cartel. Are you sure?'
        : 'Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => leaveCrew(crew.id),
        },
      ]
    );
  };

  const handleStartVote = async () => {
    if (!crew || selectedVenueIds.length < 2) return;
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
    try {
      await castVote(crew.id, activeVote.id, venueId);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const toggleVenueSelection = (venueId: string) => {
    setSelectedVenueIds(prev =>
      prev.includes(venueId)
        ? prev.filter(id => id !== venueId)
        : prev.length < 4 ? [...prev, venueId] : prev
    );
  };

  // No crew - show create/join
  if (!crew) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Vibez Cartel</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="people" size={48} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Start a Cartel</Text>
            <Text style={styles.heroSubtitle}>
              Create or join a Cartel to vote on venues, see where your squad is, and earn bonus clout!
            </Text>
          </View>

          {/* Create */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Create Your Cartel</Text>
            <TextInput
              style={styles.input}
              placeholder="Cartel name (max 20 chars)"
              placeholderTextColor={colors.text.muted}
              value={crewName}
              onChangeText={(t) => setCrewName(t.slice(0, 20))}
            />
            <TouchableOpacity
              style={[styles.button, crewName.length < 2 && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={crewName.length < 2 || loading}
            >
              <LinearGradient colors={['#FF3366', '#FF6B35']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>
                  {loading ? 'Creating...' : 'Create Cartel'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Join */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join a Cartel</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-character invite code"
              placeholderTextColor={colors.text.muted}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase().slice(0, 6))}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.button, inviteCode.length < 6 && styles.buttonDisabled]}
              onPress={handleJoin}
              disabled={inviteCode.length < 6 || loading}
            >
              <View style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>
                  {loading ? 'Joining...' : 'Join Cartel'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Has crew - show dashboard
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>{crew.name}</Text>
        <TouchableOpacity onPress={handleLeave}>
          <Ionicons name="exit-outline" size={22} color="#FF5252" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Invite Code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite Code</Text>
          <Text style={styles.codeValue}>{crew.invite_code}</Text>
          <Text style={styles.codeHint}>Share this with friends to join</Text>
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Members ({crew.members.length}/8)
          </Text>
          {crew.member_details.map((member: any) => (
            <View key={member.user_id} style={styles.memberRow}>
              <AvatarDisplay
                config={member.avatar_config || null}
                username={member.username}
                size={36}
                showBorder={member.checked_in}
                borderColor="#00E676"
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.username}
                  {member.user_id === crew.captain_id && ' (Captain)'}
                </Text>
                {member.checked_in && member.venue_name && (
                  <Text style={styles.memberVenue}>
                    At {member.venue_name}
                  </Text>
                )}
              </View>
              {member.checked_in && (
                <View style={styles.activeDot} />
              )}
            </View>
          ))}
        </View>

        {/* Squad Locations */}
        {crew.member_details.some((m: any) => m.checked_in) && (
          <View style={styles.section}>
            <View style={styles.locationHeader}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Cartel Radar</Text>
            </View>
            {crew.member_details
              .filter((m: any) => m.checked_in && m.venue_name)
              .map((member: any) => (
                <View key={member.user_id + '_loc'} style={styles.locationRow}>
                  <AvatarDisplay
                    config={member.avatar_config || null}
                    username={member.username}
                    size={32}
                  />
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{member.username}</Text>
                    <Text style={styles.locationVenue}>{member.venue_name}</Text>
                  </View>
                  <View style={styles.locationLive}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Live</Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Active Vote */}
        {activeVote && user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Vote</Text>
            <VoteCard
              options={activeVote.options}
              totalVotes={activeVote.total_votes}
              hasVoted={activeVote.has_voted || false}
              userId={user.id}
              onVote={handleCastVote}
              winner={activeVote.status === 'completed' ? activeVote.winner : null}
            />
          </View>
        )}

        {/* Start Vote (Captain only) */}
        {crew.is_captain && !activeVote && (
          <View style={styles.section}>
            {!showVotePicker ? (
              <TouchableOpacity
                style={styles.startVoteButton}
                onPress={() => setShowVotePicker(true)}
              >
                <Ionicons name="hand-left" size={20} color={colors.primary} />
                <Text style={styles.startVoteText}>Cartel Vote</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.sectionTitle}>
                  Pick 2-4 venues ({selectedVenueIds.length} selected)
                </Text>
                {lobbyVenues.map((venue) => {
                  const selected = selectedVenueIds.includes(venue.id);
                  return (
                    <TouchableOpacity
                      key={venue.id}
                      style={[styles.venuePickRow, selected && styles.venuePickSelected]}
                      onPress={() => toggleVenueSelection(venue.id)}
                    >
                      <Text style={styles.venuePickName}>{venue.name}</Text>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={selected ? colors.primary : colors.text.muted}
                      />
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.button, selectedVenueIds.length < 2 && styles.buttonDisabled]}
                  onPress={handleStartVote}
                  disabled={selectedVenueIds.length < 2 || loading}
                >
                  <LinearGradient colors={['#FF3366', '#FF6B35']} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>
                      {loading ? 'Starting...' : 'Start Vote'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pageTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  button: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  buttonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  codeCard: {
    alignItems: 'center',
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  codeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  codeValue: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: 4,
  },
  codeHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  memberVenue: {
    fontSize: typography.fontSize.xs,
    color: '#00E676',
    marginTop: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  startVoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  startVoteText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  venuePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  venuePickSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  venuePickName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.1)',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  locationVenue: {
    fontSize: typography.fontSize.xs,
    color: '#00E676',
    marginTop: 1,
  },
  locationLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00E676',
  },
});
