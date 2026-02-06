/**
 * ADMIN FLOOR - Treasury (Index)
 * Global revenue and financial overview
 * Responsive for desktop web deployment
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { adminTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';
import { useResponsive } from '../../src/utils/responsive';

const { colors } = adminTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface TreasuryData {
  global: {
    total_revenue: number;
    today_revenue: number;
  };
  by_city: Record<string, { total: number; count: number }>;
  by_tier: Record<string, { total: number; count: number }>;
  network_health: {
    socket_connections: number;
    active_venues: number;
    active_users_24h: number;
  };
  data_freshness_percent: number;
}

export default function AdminTreasury() {
  const router = useRouter();
  const { isDesktop, isTablet, breakpoint } = useResponsive();
  const { user } = useVibeStore();
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTreasury = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/treasury`, {
        headers: { 'X-User-Id': user.id },
      });
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch treasury:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasury();
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTreasury();
    setRefreshing(false);
  }, []);

  const cities = data?.by_city ? Object.entries(data.by_city).sort((a, b) => b[1].total - a[1].total) : [];

  // Responsive container style
  const containerStyle = isDesktop ? {
    maxWidth: 1200,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: spacing.xxl,
  } : {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={containerStyle}
      >
        {/* Header */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <View>
            <Text style={[styles.headerTitle, isDesktop && styles.headerTitleDesktop]}>
              Admin Treasury
            </Text>
            <Text style={styles.headerSubtitle}>Command Center</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveIndicator} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Global Revenue - Responsive Grid */}
        <View style={[styles.revenueRow, isDesktop && styles.revenueRowDesktop]}>
          <View style={[styles.revenueCard, styles.primaryRevenue, isDesktop && styles.revenueCardDesktop]}>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={[styles.revenueAmount, isDesktop && styles.revenueAmountDesktop]}>
              ₦{(data?.global.total_revenue || 0).toLocaleString()}
            </Text>
            <Text style={styles.revenueSubLabel}>All Time</Text>
          </View>
          <View style={[styles.revenueCard, isDesktop && styles.revenueCardDesktop]}>
            <Text style={styles.revenueLabel}>Today</Text>
            <Text style={styles.revenueAmountSmall}>
              ₦{(data?.global.today_revenue || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Desktop: Two-column layout for City and Tier */}
        <View style={isDesktop ? styles.twoColumnLayout : undefined}>
          {/* Revenue by City */}
          <View style={[styles.section, isDesktop && styles.sectionHalf]}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="business" size={20} color={colors.data.venues} /> Revenue by City
            </Text>
            {cities.map(([city, stats]) => (
            <View key={city} style={styles.cityRow}>
              <Text style={styles.cityFlag}>🏙️</Text>
              <Text style={styles.cityName}>{city.charAt(0).toUpperCase() + city.slice(1)}</Text>
              <Text style={styles.cityRevenue}>₦{stats.total.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Revenue by Tier */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="flash" size={20} color={colors.data.activity} /> Revenue by Tier
          </Text>
          <View style={styles.tiersRow}>
            {['supernova', 'flare', 'spark'].map((tier) => {
              const tierData = data?.by_tier?.[tier] || { total: 0, count: 0 };
              const tierColors = {
                supernova: '#FF3366',
                flare: '#FF6300',
                spark: '#FFD700',
              };
              return (
                <View key={tier} style={styles.tierCard}>
                  <Ionicons
                    name={tier === 'supernova' ? 'rocket' : tier === 'flare' ? 'flame' : 'flash'}
                    size={28}
                    color={tierColors[tier as keyof typeof tierColors]}
                  />
                  <Text style={styles.tierName}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
                  <Text style={styles.tierAmount}>₦{tierData.total.toLocaleString()}</Text>
                  <Text style={styles.tierCount}>{tierData.count} drops</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Network Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="pulse" size={20} color={colors.status.online} /> Network Health
          </Text>
          <View style={styles.healthGrid}>
            <View style={styles.healthCard}>
              <Ionicons name="wifi" size={24} color={colors.status.online} />
              <Text style={styles.healthValue}>{data?.network_health.socket_connections || 0}</Text>
              <Text style={styles.healthLabel}>Connections</Text>
            </View>
            <View style={styles.healthCard}>
              <Ionicons name="business" size={24} color={colors.data.venues} />
              <Text style={styles.healthValue}>{data?.network_health.active_venues || 0}</Text>
              <Text style={styles.healthLabel}>Active Venues</Text>
            </View>
            <View style={styles.healthCard}>
              <Ionicons name="people" size={24} color={colors.data.users} />
              <Text style={styles.healthValue}>{data?.network_health.active_users_24h || 0}</Text>
              <Text style={styles.healthLabel}>Users (24h)</Text>
            </View>
            <View style={styles.healthCard}>
              <Ionicons name="sync" size={24} color={colors.data.activity} />
              <Text style={styles.healthValue}>{data?.data_freshness_percent || 0}%</Text>
              <Text style={styles.healthLabel}>Data Fresh</Text>
            </View>
          </View>
        </View>

        {/* Switch Floor Button */}
        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => router.replace('/(public)')}
        >
          <Ionicons name="map-outline" size={20} color={colors.primary} />
          <Text style={styles.switchText}>Switch to Public View</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.online + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.online,
  },
  liveText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.status.online,
  },
  revenueRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  primaryRevenue: {
    flex: 2,
    backgroundColor: colors.data.revenue + '20',
  },
  revenueLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  revenueAmount: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.black,
    color: colors.data.revenue,
    marginVertical: spacing.sm,
  },
  revenueAmountSmall: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  revenueSubLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
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
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cityFlag: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  cityName: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  cityRevenue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.data.revenue,
  },
  tiersRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tierCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  tierName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  tierAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
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
    gap: spacing.md,
  },
  healthCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  healthValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  healthLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  switchText: {
    fontSize: typography.fontSize.md,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
});
