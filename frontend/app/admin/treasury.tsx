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
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '../../src/theme';
import { useVibeStore } from '../../src/store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');

interface TreasuryData {
  global: {
    total_revenue: number;
    today_revenue: number;
  };
  revenue_by_city: Record<string, { total: number; transactions: number }>;
  revenue_by_tier: Record<string, { total: number; transactions: number }>;
  network_health: {
    active_connections: number;
    total_venues: number;
    verified_venues: number;
    total_users: number;
    active_users_24h: number;
  };
  data_freshness_percent: number;
}

export default function AdminTreasury() {
  const router = useRouter();
  const { user } = useVibeStore();
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTreasury();
  }, []);

  const fetchTreasury = async () => {
    try {
      setError(null);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add user ID header for authentication
      if (user?.id) {
        headers['X-User-Id'] = user.id;
      }
      
      const response = await fetch(`${API_URL}/api/admin/treasury`, {
        headers,
        credentials: 'include',
      });
      
      if (response.status === 403) {
        setError('Super Admin access required');
        setLoading(false);
        return;
      }
      
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      setError('Failed to load treasury data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTreasury();
    setRefreshing(false);
  }, []);

  const getCityEmoji = (city: string) => {
    switch (city) {
      case 'lagos': return '🏙️';
      case 'abuja': return '🌆';
      case 'port_harcourt': return '🌴';
      case 'ibadan': return '🏛️';
      default: return '📍';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'spark': return colors.pulseTier.spark;
      case 'flare': return colors.pulseTier.flare;
      case 'supernova': return colors.pulseTier.supernova;
      default: return colors.text.muted;
    }
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

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const cities = Object.entries(data.revenue_by_city).sort((a, b) => b[1].total - a[1].total);
  const tiers = Object.entries(data.revenue_by_tier).sort((a, b) => b[1].total - a[1].total);
  const topCity = cities[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Super Admin Treasury</Text>
          <Text style={styles.headerSubtitle}>God View</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveIndicator} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Global Revenue Cards */}
        <View style={styles.revenueSection}>
          <View style={styles.revenueCardMain}>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={styles.revenueAmount}>₦{data.global.total_revenue.toLocaleString()}</Text>
            <View style={styles.revenueSubtext}>
              <Ionicons name="trending-up" size={14} color={colors.status.success} />
              <Text style={styles.revenuePeriod}>All Time</Text>
            </View>
          </View>
          <View style={styles.revenueCardSecondary}>
            <Text style={styles.revenueLabelSmall}>Today</Text>
            <Text style={styles.revenueAmountSmall}>₦{data.global.today_revenue.toLocaleString()}</Text>
          </View>
        </View>

        {/* Revenue Heatmap by City */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="map" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Revenue Heatmap</Text>
          </View>
          <View style={styles.heatmapContainer}>
            {cities.map(([city, stats], index) => {
              const maxRevenue = topCity ? topCity[1].total : 1;
              const percentage = (stats.total / maxRevenue) * 100;
              
              return (
                <View key={city} style={styles.heatmapItem}>
                  <View style={styles.heatmapHeader}>
                    <Text style={styles.heatmapEmoji}>{getCityEmoji(city)}</Text>
                    <Text style={styles.heatmapCity}>
                      {city.charAt(0).toUpperCase() + city.slice(1).replace('_', ' ')}
                    </Text>
                    <Text style={styles.heatmapValue}>₦{stats.total.toLocaleString()}</Text>
                  </View>
                  <View style={styles.heatmapBar}>
                    <View 
                      style={[
                        styles.heatmapFill, 
                        { 
                          width: `${percentage}%`,
                          backgroundColor: index === 0 ? colors.status.success : 
                                          index === 1 ? colors.status.info : 
                                          colors.text.muted
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.heatmapTransactions}>{stats.transactions} transactions</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Revenue by Tier */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Revenue by Tier</Text>
          </View>
          <View style={styles.tierGrid}>
            {tiers.map(([tier, stats]) => (
              <View key={tier} style={[styles.tierCard, { borderColor: getTierColor(tier) + '40' }]}>
                <View style={[styles.tierIcon, { backgroundColor: getTierColor(tier) + '20' }]}>
                  <Ionicons 
                    name={tier === 'supernova' ? 'star' : tier === 'flare' ? 'flame' : 'flash'} 
                    size={24} 
                    color={getTierColor(tier)} 
                  />
                </View>
                <Text style={[styles.tierName, { color: getTierColor(tier) }]}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </Text>
                <Text style={styles.tierAmount}>₦{stats.total.toLocaleString()}</Text>
                <Text style={styles.tierCount}>{stats.transactions} drops</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Network Health */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pulse" size={20} color={colors.status.success} />
            <Text style={styles.sectionTitle}>Network Health</Text>
          </View>
          <View style={styles.healthGrid}>
            <View style={styles.healthCard}>
              <Ionicons name="wifi" size={28} color={colors.status.success} />
              <Text style={styles.healthValue}>{data.network_health.active_connections}</Text>
              <Text style={styles.healthLabel}>Active Connections</Text>
            </View>
            <View style={styles.healthCard}>
              <Ionicons name="business" size={28} color={colors.status.info} />
              <Text style={styles.healthValue}>
                {data.network_health.verified_venues}/{data.network_health.total_venues}
              </Text>
              <Text style={styles.healthLabel}>Verified Venues</Text>
            </View>
            <View style={styles.healthCard}>
              <Ionicons name="people" size={28} color={colors.secondary} />
              <Text style={styles.healthValue}>{data.network_health.active_users_24h}</Text>
              <Text style={styles.healthLabel}>Active Users (24h)</Text>
            </View>
            <View style={styles.healthCard}>
              <Ionicons name="timer" size={28} color={colors.gold} />
              <Text style={styles.healthValue}>{data.data_freshness_percent}%</Text>
              <Text style={styles.healthLabel}>Data Freshness</Text>
            </View>
          </View>
        </View>

        {/* Data Freshness Indicator */}
        <View style={styles.freshnessCard}>
          <View style={styles.freshnessHeader}>
            <Text style={styles.freshnessTitle}>Data Quality</Text>
            <Text style={styles.freshnessPercent}>{data.data_freshness_percent}%</Text>
          </View>
          <Text style={styles.freshnessSubtext}>
            of ratings are less than 15 minutes old
          </Text>
          <View style={styles.freshnessBar}>
            <View 
              style={[
                styles.freshnessFill, 
                { 
                  width: `${data.data_freshness_percent}%`,
                  backgroundColor: data.data_freshness_percent >= 80 ? colors.status.success :
                                  data.data_freshness_percent >= 50 ? colors.status.warning :
                                  colors.status.error
                }
              ]} 
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/admin/venues')}>
              <Ionicons name="business" size={24} color={colors.primary} />
              <Text style={styles.actionText}>Manage Venues</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/admin/pricing')}>
              <Ionicons name="pricetag" size={24} color={colors.gold} />
              <Text style={styles.actionText}>Tier Pricing</Text>
            </TouchableOpacity>
          </View>
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
    textAlign: 'center',
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
    color: colors.gold,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  liveText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.status.success,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  revenueSection: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  revenueCardMain: {
    flex: 2,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  revenueLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  revenueAmount: {
    fontSize: typography.fontSize.hero,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  revenueSubtext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  revenuePeriod: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  revenueCardSecondary: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  revenueLabelSmall: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  revenueAmountSmall: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  heatmapContainer: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  heatmapItem: {
    marginBottom: spacing.lg,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heatmapEmoji: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  heatmapCity: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  heatmapValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  heatmapBar: {
    height: 8,
    backgroundColor: colors.background.input,
    borderRadius: 4,
    overflow: 'hidden',
  },
  heatmapFill: {
    height: '100%',
    borderRadius: 4,
  },
  heatmapTransactions: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  tierGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tierCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tierName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  tierAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  tierCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  healthCard: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  healthValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  healthLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  freshnessCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  freshnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  freshnessTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  freshnessPercent: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black,
    color: colors.status.success,
  },
  freshnessSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  freshnessBar: {
    height: 8,
    backgroundColor: colors.background.input,
    borderRadius: 4,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  freshnessFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsSection: {
    marginTop: spacing.xl,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
});
