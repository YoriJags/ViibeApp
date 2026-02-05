/**
 * MERCHANT FLOOR - Overview (Index)
 * Business Dashboard with ROI Metrics
 */
import React, { useEffect, useState, useCallback } from 'react';
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
import { merchantTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = merchantTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VenueStats {
  venue: {
    id: string;
    name: string;
    area: string;
    current_vibe_score: number;
    wallet_balance: number;
  };
  rank: number;
  total_in_area: number;
  district_average: number;
  roi_metrics: {
    profile_views: number;
    direction_clicks: number;
    total_ratings: number;
    conversion_rate: number;
  };
}

export default function MerchantOverview() {
  const router = useRouter();
  const { user } = useVibeStore();
  const [stats, setStats] = useState<VenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    if (!user?.merchant_venue_id) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/stats`,
        { headers: { 'X-User-Id': user.id } }
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user?.merchant_venue_id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, []);

  const getVibeStatus = (score: number) => {
    if (score >= 80) return { label: 'On Fire', color: colors.status.profit };
    if (score >= 60) return { label: 'Heating Up', color: colors.primary };
    if (score >= 40) return { label: 'Warming', color: colors.secondary };
    return { label: 'Quiet', color: colors.text.muted };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vibeStatus = getVibeStatus(stats?.venue.current_vibe_score || 0);
  const delta = (stats?.venue.current_vibe_score || 0) - (stats?.district_average || 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Merchant Dashboard</Text>
            <Text style={styles.venueName}>{stats?.venue.name || 'Your Venue'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.switchButton}
            onPress={() => router.replace('/(public)')}
          >
            <Ionicons name="map-outline" size={20} color={colors.primary} />
            <Text style={styles.switchText}>Public</Text>
          </TouchableOpacity>
        </View>

        {/* Vibe Score Hero */}
        <View style={styles.heroCard}>
          <View style={styles.vibeScoreContainer}>
            <Text style={[styles.vibeScore, { color: vibeStatus.color }]}>
              {stats?.venue.current_vibe_score || 0}
            </Text>
            <Text style={styles.vibeLabel}>Vibe Score</Text>
            <View style={[styles.statusBadge, { backgroundColor: vibeStatus.color + '20' }]}>
              <Text style={[styles.statusText, { color: vibeStatus.color }]}>
                {vibeStatus.label}
              </Text>
            </View>
          </View>
          <View style={styles.rankContainer}>
            <Text style={styles.rankNumber}>#{stats?.rank || '-'}</Text>
            <Text style={styles.rankLabel}>in {stats?.venue.area}</Text>
          </View>
        </View>

        {/* Heatmap Delta */}
        <View style={styles.deltaCard}>
          <View style={styles.deltaHeader}>
            <Ionicons name="trending-up" size={24} color={colors.status.profit} />
            <Text style={styles.deltaTitle}>Beat the Block</Text>
          </View>
          <View style={styles.deltaRow}>
            <View style={styles.deltaItem}>
              <Text style={styles.deltaValue}>{stats?.venue.current_vibe_score || 0}</Text>
              <Text style={styles.deltaLabel}>Your Score</Text>
            </View>
            <View style={styles.deltaArrow}>
              <Ionicons 
                name={delta >= 0 ? "arrow-up" : "arrow-down"} 
                size={24} 
                color={delta >= 0 ? colors.status.profit : colors.status.loss} 
              />
            </View>
            <View style={styles.deltaItem}>
              <Text style={styles.deltaValue}>{(stats?.district_average || 0).toFixed(1)}</Text>
              <Text style={styles.deltaLabel}>District Avg</Text>
            </View>
          </View>
          <View style={[
            styles.deltaBadge, 
            { backgroundColor: delta >= 0 ? colors.status.profit + '20' : colors.status.loss + '20' }
          ]}>
            <Text style={[
              styles.deltaBadgeText, 
              { color: delta >= 0 ? colors.status.profit : colors.status.loss }
            ]}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs competition
            </Text>
          </View>
        </View>

        {/* ROI Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROI Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="eye" size={28} color={colors.primary} />
              <Text style={styles.metricValue}>{stats?.roi_metrics?.profile_views || 0}</Text>
              <Text style={styles.metricLabel}>Profile Views</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="navigate" size={28} color={colors.status.info} />
              <Text style={styles.metricValue}>{stats?.roi_metrics?.direction_clicks || 0}</Text>
              <Text style={styles.metricLabel}>Directions</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="star" size={28} color={colors.gold} />
              <Text style={styles.metricValue}>{stats?.roi_metrics?.total_ratings || 0}</Text>
              <Text style={styles.metricLabel}>Ratings</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="trending-up" size={28} color={colors.status.profit} />
              <Text style={styles.metricValue}>{(stats?.roi_metrics.conversion_rate || 0).toFixed(1)}%</Text>
              <Text style={styles.metricLabel}>Conversion</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(merchant)/pulse')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="flash" size={24} color={colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Trigger Pulse Drop</Text>
              <Text style={styles.actionDesc}>Boost your visibility now</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

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
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  venueName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  switchText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  heroCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  vibeScoreContainer: {
    alignItems: 'flex-start',
  },
  vibeScore: {
    fontSize: 64,
    fontWeight: typography.fontWeight.black,
  },
  vibeLabel: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    marginTop: -spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  rankContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  rankLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  deltaCard: {
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  deltaItem: {
    alignItems: 'center',
  },
  deltaValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  deltaLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  deltaArrow: {
    padding: spacing.sm,
  },
  deltaBadge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  deltaBadgeText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  metricLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  actionDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
});
