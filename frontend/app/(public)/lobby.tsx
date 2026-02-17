/**
 * PUBLIC FLOOR - Lobby (My Shortlist)
 * Users compare their shortlisted venues side-by-side with live data.
 * Smart nudge highlights the hottest venue to go to tonight.
 */
import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { publicTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = publicTheme;

const ENERGY_COLORS: Record<string, string> = {
  chill: '#4FC3F7',
  popping: '#FF9800',
  electric: '#FF3366',
};

const VELOCITY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  heating_up: { icon: 'trending-up', color: '#4CAF50', label: 'Rising' },
  cooling_down: { icon: 'trending-down', color: '#FF5252', label: 'Falling' },
  stable: { icon: 'remove', color: '#888', label: 'Stable' },
};

export default function LobbyScreen() {
  const router = useRouter();
  const {
    lobbyVenues,
    lobbyNudge,
    lobbyLoading,
    isAuthenticated,
    isDemoMode,
    fetchLobby,
    removeFromLobby,
  } = useVibeStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    if (isAuthenticated || isDemoMode) {
      fetchLobby();
    }
  }, [isAuthenticated, isDemoMode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLobby();
    setRefreshing(false);
  }, []);

  const handleRemove = async (venueId: string) => {
    await removeFromLobby(venueId);
  };

  // Not logged in
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="heart-outline" size={64} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your Lobby</Text>
          <Text style={styles.emptySubtitle}>
            Sign in to save venues and compare them side-by-side
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/profile')}
          >
            <LinearGradient
              colors={['#FF3366', '#FF6B35']}
              style={styles.signInGradient}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading
  if (lobbyLoading && lobbyVenues.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Lobby</Text>
          <Text style={styles.headerSubtitle}>Tonight's picks</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Lobby</Text>
          <Text style={styles.headerSubtitle}>
            {lobbyVenues.length > 0
              ? `${lobbyVenues.length} venue${lobbyVenues.length > 1 ? 's' : ''} saved`
              : "Tonight's picks"}
          </Text>
        </View>

        {/* Smart Nudge */}
        {lobbyNudge && lobbyNudge.type === 'go_here' && (
          <TouchableOpacity
            style={styles.nudgeCard}
            onPress={() => router.push(`/venue/${lobbyNudge.venue_id}`)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#FF3366', '#FF6B35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nudgeGradient}
            >
              <View style={styles.nudgeContent}>
                <View style={styles.nudgeIconWrap}>
                  <Ionicons name="flash" size={24} color="#FFF" />
                </View>
                <View style={styles.nudgeTextWrap}>
                  <Text style={styles.nudgeLabel}>TONIGHT'S PICK</Text>
                  <Text style={styles.nudgeMessage}>{lobbyNudge.message}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {lobbyNudge && lobbyNudge.type === 'quiet_night' && (
          <View style={styles.quietNudge}>
            <Ionicons name="moon-outline" size={20} color="#888" />
            <Text style={styles.quietNudgeText}>{lobbyNudge.message}</Text>
          </View>
        )}

        {/* Empty State */}
        {lobbyVenues.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bookmark-outline" size={64} color="#333" />
            </View>
            <Text style={styles.emptyTitle}>No venues saved yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the bookmark icon on any venue to add it here. Compare live vibes and decide where to go!
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.exploreButtonText}>Explore Venues</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Venue Cards */}
        {lobbyVenues.map((venue, index) => {
          const vibeColor = getVibeColor(venue.current_vibe_score);
          const velocity = VELOCITY_CONFIG[venue.vibe_velocity] || VELOCITY_CONFIG.stable;

          return (
            <TouchableOpacity
              key={venue.id}
              style={styles.venueCard}
              onPress={() => router.push(`/venue/${venue.id}`)}
              activeOpacity={0.85}
            >
              {/* Rank Indicator */}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>

              {/* Main Content */}
              <View style={styles.venueContent}>
                {/* Name + Badges */}
                <View style={styles.venueNameRow}>
                  <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
                  {venue.active_pulse_tier && (
                    <View style={styles.pulseBadge}>
                      <Ionicons name="flame" size={10} color="#FFD700" />
                    </View>
                  )}
                </View>

                {/* Area */}
                <Text style={styles.venueArea}>{venue.area}</Text>

                {/* Live Stats Row */}
                <View style={styles.statsRow}>
                  {/* Vibe Score */}
                  <View style={[styles.statBadge, { backgroundColor: `${vibeColor}15` }]}>
                    <View style={[styles.statDot, { backgroundColor: vibeColor }]} />
                    <Text style={[styles.statText, { color: vibeColor }]}>
                      {Math.round(venue.current_vibe_score)}%
                    </Text>
                  </View>

                  {/* Energy */}
                  <View style={[styles.statBadge, { backgroundColor: `${ENERGY_COLORS[venue.energy_level] || '#888'}15` }]}>
                    <Text style={[styles.statText, { color: ENERGY_COLORS[venue.energy_level] || '#888' }]}>
                      {venue.energy_level}
                    </Text>
                  </View>

                  {/* Velocity */}
                  <View style={styles.statBadge}>
                    <Ionicons name={velocity.icon as any} size={12} color={velocity.color} />
                    <Text style={[styles.statText, { color: velocity.color }]}>{velocity.label}</Text>
                  </View>

                  {/* Gate */}
                  <View style={styles.statBadge}>
                    <Ionicons
                      name={venue.gate_level === 'clear' ? 'checkmark-circle' : venue.gate_level === 'slow' ? 'time' : 'close-circle'}
                      size={12}
                      color={venue.gate_level === 'clear' ? '#4CAF50' : venue.gate_level === 'slow' ? '#FF9800' : '#FF5252'}
                    />
                    <Text style={[styles.statText, {
                      color: venue.gate_level === 'clear' ? '#4CAF50' : venue.gate_level === 'slow' ? '#FF9800' : '#FF5252',
                    }]}>
                      {venue.gate_level}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Remove Button */}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(venue.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="bookmark" size={20} color={colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getVibeColor(score: number): string {
  if (score >= 80) return '#FF3366';
  if (score >= 60) return '#FF9933';
  if (score >= 40) return '#9933FF';
  return '#3399FF';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },

  // Nudge
  nudgeCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  nudgeGradient: {
    padding: spacing.lg,
  },
  nudgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nudgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  nudgeTextWrap: {
    flex: 1,
  },
  nudgeLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  nudgeMessage: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFF',
  },
  quietNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  quietNudgeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    flex: 1,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xxl,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  exploreButton: {
    backgroundColor: colors.background.card,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exploreButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  signInButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  signInGradient: {
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.md,
  },
  signInText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },

  // Venue Card
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rankText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
  },
  venueContent: {
    flex: 1,
  },
  venueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  venueName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  pulseBadge: {
    backgroundColor: '#FFD70030',
    padding: 3,
    borderRadius: 4,
  },
  venueArea: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.muted,
    textTransform: 'capitalize',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
});
