import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '../../src/theme';
import { PulseDropSelector } from '../../src/components/PulseDropSelector';
import { VibeMeter } from '../../src/components/VibeMeter';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');

interface MerchantStats {
  venue: any;
  stats: {
    ratings_1h: number;
    ratings_24h: number;
    ratings_7d: number;
    profile_views: number;
    direction_clicks: number;
    current_rank: number;
    total_area_venues: number;
  };
  heatmap_delta: {
    venue_score: number;
    district_average: number;
    delta: number;
  };
  pulse_drop_roi: any[];
  hourly_trend: any[];
  competitors: any[];
  wallet_balance: number;
}

export default function MerchantDashboard() {
  const { venue_id } = useLocalSearchParams<{ venue_id: string }>();
  const router = useRouter();
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (venue_id) {
      fetchStats();
    }
  }, [venue_id]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/merchant/venue/${venue_id}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [venue_id]);

  const handleTopUp = () => {
    // Navigate to wallet top-up screen
    router.push(`/merchant/topup/${venue_id}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.status.error} />
          <Text style={styles.errorText}>Failed to load dashboard</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { venue, heatmap_delta, competitors } = stats;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Merchant Dashboard</Text>
          <Text style={styles.headerSubtitle}>{venue.name}</Text>
        </View>
        <View style={styles.walletBadge}>
          <Ionicons name="wallet" size={16} color={colors.gold} />
          <Text style={styles.walletAmount}>
            ₦{stats.wallet_balance.toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Vibe Score & Rank */}
        <View style={styles.scoreSection}>
          <VibeMeter
            score={venue.current_vibe_score}
            velocity={venue.vibe_velocity}
            size="large"
            showLabel
            showVelocity
          />
          <View style={styles.rankBadge}>
            <Text style={styles.rankNumber}>#{stats.stats.current_rank}</Text>
            <Text style={styles.rankLabel}>in {venue.area}</Text>
          </View>
        </View>

        {/* Heatmap Delta - "Beat the Block" */}
        <View style={styles.deltaCard}>
          <View style={styles.deltaHeader}>
            <Ionicons name="analytics" size={24} color={colors.primary} />
            <Text style={styles.deltaTitle}>Heatmap Delta</Text>
          </View>
          <View style={styles.deltaContent}>
            <View style={styles.deltaItem}>
              <Text style={styles.deltaValue}>{heatmap_delta.venue_score}</Text>
              <Text style={styles.deltaLabel}>Your Score</Text>
            </View>
            <View style={styles.deltaDivider}>
              <Ionicons
                name={heatmap_delta.delta >= 0 ? 'arrow-up' : 'arrow-down'}
                size={24}
                color={heatmap_delta.delta >= 0 ? colors.status.success : colors.status.error}
              />
            </View>
            <View style={styles.deltaItem}>
              <Text style={styles.deltaValue}>{heatmap_delta.district_average}</Text>
              <Text style={styles.deltaLabel}>District Avg</Text>
            </View>
          </View>
          <View style={[
            styles.deltaResultBadge,
            { backgroundColor: heatmap_delta.delta >= 0 ? colors.status.success + '20' : colors.status.error + '20' }
          ]}>
            <Text style={[
              styles.deltaResultText,
              { color: heatmap_delta.delta >= 0 ? colors.status.success : colors.status.error }
            ]}>
              {heatmap_delta.delta >= 0 ? '+' : ''}{heatmap_delta.delta.toFixed(1)} vs competition
            </Text>
          </View>
        </View>

        {/* ROI Metrics */}
        <View style={styles.roiSection}>
          <Text style={styles.sectionTitle}>ROI Metrics</Text>
          <View style={styles.roiGrid}>
            <View style={styles.roiCard}>
              <Ionicons name="eye" size={28} color={colors.status.info} />
              <Text style={styles.roiValue}>{stats.stats.profile_views.toLocaleString()}</Text>
              <Text style={styles.roiLabel}>Profile Views</Text>
            </View>
            <View style={styles.roiCard}>
              <Ionicons name="navigate" size={28} color={colors.status.success} />
              <Text style={styles.roiValue}>{stats.stats.direction_clicks.toLocaleString()}</Text>
              <Text style={styles.roiLabel}>Direction Clicks</Text>
            </View>
            <View style={styles.roiCard}>
              <Ionicons name="star" size={28} color={colors.gold} />
              <Text style={styles.roiValue}>{stats.stats.ratings_24h}</Text>
              <Text style={styles.roiLabel}>Ratings (24h)</Text>
            </View>
            <View style={styles.roiCard}>
              <Ionicons name="trending-up" size={28} color={colors.primary} />
              <Text style={styles.roiValue}>
                {stats.stats.profile_views > 0 
                  ? ((stats.stats.direction_clicks / stats.stats.profile_views) * 100).toFixed(1) + '%'
                  : '0%'}
              </Text>
              <Text style={styles.roiLabel}>Conversion Rate</Text>
            </View>
          </View>
        </View>

        {/* Trigger Pulse Drop - "Beat the Block" Tool */}
        <View style={styles.pulseSection}>
          <Text style={styles.sectionTitle}>Beat the Block</Text>
          <PulseDropSelector
            venueId={venue_id || ''}
            walletBalance={stats.wallet_balance}
            onPurchaseSuccess={() => fetchStats()}
            onTopUpNeeded={handleTopUp}
          />
        </View>

        {/* Competition Analysis */}
        <View style={styles.competitionSection}>
          <Text style={styles.sectionTitle}>Competition</Text>
          {competitors.map((comp, index) => (
            <View key={comp.id} style={styles.competitorItem}>
              <View style={styles.competitorRank}>
                <Text style={styles.competitorRankText}>{index + 1}</Text>
              </View>
              <View style={styles.competitorInfo}>
                <Text style={styles.competitorName}>{comp.name}</Text>
                <Text style={styles.competitorArea}>{comp.area}</Text>
              </View>
              <Text style={[
                styles.competitorScore,
                { color: comp.current_vibe_score > venue.current_vibe_score ? colors.status.error : colors.status.success }
              ]}>
                {Math.round(comp.current_vibe_score)}
              </Text>
            </View>
          ))}
        </View>

        {/* Top Up Wallet CTA */}
        <TouchableOpacity style={styles.topUpButton} onPress={handleTopUp}>
          <Ionicons name="add-circle" size={24} color={colors.text.primary} />
          <Text style={styles.topUpText}>Top Up Wallet</Text>
        </TouchableOpacity>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  retryText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  walletAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  rankBadge: {
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: typography.fontSize.hero,
    fontWeight: typography.fontWeight.black,
    color: colors.gold,
  },
  rankLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  deltaCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  deltaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  deltaTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  deltaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  deltaItem: {
    alignItems: 'center',
  },
  deltaValue: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
  },
  deltaLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  deltaDivider: {
    paddingHorizontal: spacing.lg,
  },
  deltaResultBadge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  deltaResultText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  roiSection: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  roiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  roiCard: {
    width: (width - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  roiValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  roiLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  pulseSection: {
    marginTop: spacing.xl,
  },
  competitionSection: {
    marginTop: spacing.xl,
  },
  competitorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  competitorRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.input,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  competitorRankText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  competitorInfo: {
    flex: 1,
  },
  competitorName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  competitorArea: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  competitorScore: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.extrabold,
  },
  topUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  topUpText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.background.dark,
  },
});
