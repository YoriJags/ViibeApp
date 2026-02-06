/**
 * ADMIN FLOOR - Macro-Vibe Analytics Dashboard
 * Theme: Royal Blue and Slate (Professional/Power aesthetic)
 * Features:
 * - Treasury Ledger with Pulse Drop revenue
 * - User Analytics (Active vs Ghost users)
 * - Integrity Monitor (Merchant claims vs Scout ratings)
 * - Clout Economy with Airdrop functionality
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
  TextInput,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../../src/store/vibeStore';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Royal Blue & Slate Admin Theme
const adminColors = {
  background: '#0A0E14',
  cardBackground: '#12181F',
  cardElevated: '#1A222C',
  inputBackground: '#1E2A36',
  primary: '#4169E1', // Royal Blue
  secondary: '#6C8EBF',
  accent: '#00BFFF',
  gold: '#FFD700',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E3A5F',
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
  revenue: '#22C55E',
  users: '#3B82F6',
  venues: '#A855F7',
};

interface LedgerItem {
  drop_id: string;
  venue_name: string;
  venue_area: string;
  current_vibe_score: number;
  tier: string;
  amount: number;
  created_at: string;
  scout_activity: string;
  ratings_count: number;
  profile_views_gained: number;
  direction_clicks_gained: number;
}

interface TreasuryData {
  global: { total_revenue: number; today_revenue: number };
  revenue_by_tier: Record<string, { total: number; transactions: number }>;
  network_health: { 
    active_connections: number; 
    total_venues: number; 
    total_users: number; 
    active_users_24h: number;
    verified_venues: number;
  };
  data_freshness_percent: number;
}

interface IntegrityData {
  sponsored: {
    count: number;
    average_energy: number;
    venues: Array<{ id: string; name: string; energy_score: number }>;
    distribution: { electric: number; popping: number; moderate: number; quiet: number };
  };
  organic: {
    count: number;
    average_energy: number;
    distribution: { electric: number; popping: number; moderate: number; quiet: number };
  };
  delta: number;
  integrity_warnings: Array<{ venue_id: string; venue_name: string; energy_score: number; issue: string }>;
  health_status: string;
}

interface CloutEconomy {
  total_clout_circulation: number;
  total_users: number;
  average_clout: number;
  top_scouts: Array<{
    rank: number;
    id: string;
    username: string;
    clout_points: number;
    scout_status: string;
    total_ratings: number;
    tier_color: string;
  }>;
}

interface UserAnalytics {
  total_users: number;
  active_users_24h: number;
  active_users_7d: number;
  ghost_users: number;
  ghost_percentage: number;
  new_users_today: number;
  tier_distribution: {
    elite: number;
    scout: number;
    regular: number;
    newbie: number;
  };
}

type TabType = 'treasury' | 'venues' | 'users' | 'logs';

// ===== DEMO MODE DATA =====
// Realistic mock data showcasing platform potential for merchant demos
const DEMO_TREASURY: TreasuryData = {
  global: { total_revenue: 2847500, today_revenue: 185000 },
  revenue_by_tier: {
    supernova: { total: 1250000, transactions: 25 },
    flare: { total: 987500, transactions: 79 },
    spark: { total: 610000, transactions: 244 },
  },
  network_health: {
    active_connections: 1247,
    total_venues: 156,
    total_users: 8432,
    active_users_24h: 2156,
    verified_venues: 89,
  },
  data_freshness_percent: 94,
};

const DEMO_LEDGER: LedgerItem[] = [
  { drop_id: 'd1', venue_name: 'Quilox Nightclub', venue_area: 'Victoria Island', current_vibe_score: 92, tier: 'supernova', amount: 50000, created_at: new Date(Date.now() - 15 * 60000).toISOString(), scout_activity: 'HIGH', ratings_count: 47, profile_views_gained: 890, direction_clicks_gained: 234 },
  { drop_id: 'd2', venue_name: 'Club 57', venue_area: 'Lekki Phase 1', current_vibe_score: 85, tier: 'flare', amount: 12500, created_at: new Date(Date.now() - 45 * 60000).toISOString(), scout_activity: 'MODERATE', ratings_count: 28, profile_views_gained: 456, direction_clicks_gained: 112 },
  { drop_id: 'd3', venue_name: 'Hardrock Cafe', venue_area: 'Victoria Island', current_vibe_score: 78, tier: 'spark', amount: 2500, created_at: new Date(Date.now() - 90 * 60000).toISOString(), scout_activity: 'MODERATE', ratings_count: 15, profile_views_gained: 234, direction_clicks_gained: 67 },
  { drop_id: 'd4', venue_name: 'DNA Lounge', venue_area: 'Ikeja GRA', current_vibe_score: 88, tier: 'flare', amount: 12500, created_at: new Date(Date.now() - 120 * 60000).toISOString(), scout_activity: 'HIGH', ratings_count: 34, profile_views_gained: 567, direction_clicks_gained: 145 },
  { drop_id: 'd5', venue_name: 'Skybar Lagos', venue_area: 'Eko Atlantic', current_vibe_score: 95, tier: 'supernova', amount: 50000, created_at: new Date(Date.now() - 180 * 60000).toISOString(), scout_activity: 'VERY HIGH', ratings_count: 62, profile_views_gained: 1230, direction_clicks_gained: 345 },
  { drop_id: 'd6', venue_name: 'The Place', venue_area: 'Lekki Phase 1', current_vibe_score: 72, tier: 'spark', amount: 2500, created_at: new Date(Date.now() - 240 * 60000).toISOString(), scout_activity: 'LOW', ratings_count: 8, profile_views_gained: 156, direction_clicks_gained: 34 },
  { drop_id: 'd7', venue_name: 'Velvet Lounge', venue_area: 'Victoria Island', current_vibe_score: 81, tier: 'flare', amount: 12500, created_at: new Date(Date.now() - 300 * 60000).toISOString(), scout_activity: 'MODERATE', ratings_count: 22, profile_views_gained: 378, direction_clicks_gained: 89 },
  { drop_id: 'd8', venue_name: 'Buzz Bar', venue_area: 'Ikoyi', current_vibe_score: 76, tier: 'spark', amount: 2500, created_at: new Date(Date.now() - 360 * 60000).toISOString(), scout_activity: 'MODERATE', ratings_count: 12, profile_views_gained: 198, direction_clicks_gained: 45 },
];

const DEMO_INTEGRITY: IntegrityData = {
  sponsored: {
    count: 23,
    average_energy: 82,
    venues: [
      { id: 'v1', name: 'Quilox Nightclub', energy_score: 92 },
      { id: 'v2', name: 'Skybar Lagos', energy_score: 95 },
      { id: 'v3', name: 'DNA Lounge', energy_score: 88 },
    ],
    distribution: { electric: 8, popping: 10, moderate: 4, quiet: 1 },
  },
  organic: {
    count: 133,
    average_energy: 68,
    distribution: { electric: 15, popping: 45, moderate: 52, quiet: 21 },
  },
  delta: 14,
  integrity_warnings: [],
  health_status: 'healthy',
};

const DEMO_CLOUT_ECONOMY: CloutEconomy = {
  total_clout_circulation: 847250,
  total_users: 8432,
  average_clout: 100,
  top_scouts: [
    { rank: 1, id: 's1', username: 'NightOwlKing', clout_points: 12450, scout_status: 'elite', total_ratings: 234, tier_color: '#FFD700' },
    { rank: 2, id: 's2', username: 'LagosVibeCheck', clout_points: 9870, scout_status: 'elite', total_ratings: 189, tier_color: '#FFD700' },
    { rank: 3, id: 's3', username: 'ClubHopper_NG', clout_points: 8340, scout_status: 'elite', total_ratings: 156, tier_color: '#FFD700' },
    { rank: 4, id: 's4', username: 'VIQueen', clout_points: 6720, scout_status: 'scout', total_ratings: 128, tier_color: '#C0C0C0' },
    { rank: 5, id: 's5', username: 'PartyPilot', clout_points: 5890, scout_status: 'scout', total_ratings: 112, tier_color: '#C0C0C0' },
    { rank: 6, id: 's6', username: 'LekkiLegend', clout_points: 4560, scout_status: 'scout', total_ratings: 98, tier_color: '#C0C0C0' },
    { rank: 7, id: 's7', username: 'NightCrawler', clout_points: 3890, scout_status: 'scout', total_ratings: 87, tier_color: '#C0C0C0' },
    { rank: 8, id: 's8', username: 'VibeDetector', clout_points: 3450, scout_status: 'regular', total_ratings: 76, tier_color: '#CD7F32' },
    { rank: 9, id: 's9', username: 'ClubScout234', clout_points: 2980, scout_status: 'regular', total_ratings: 65, tier_color: '#CD7F32' },
    { rank: 10, id: 's10', username: 'PartyRadar', clout_points: 2670, scout_status: 'regular', total_ratings: 58, tier_color: '#CD7F32' },
  ],
};

const DEMO_USER_ANALYTICS: UserAnalytics = {
  total_users: 8432,
  active_users_24h: 2156,
  active_users_7d: 4850,
  ghost_users: 1264,
  ghost_percentage: 15,
  new_users_today: 127,
  tier_distribution: {
    elite: 45,
    scout: 312,
    regular: 2890,
    newbie: 5185,
  },
};

export default function AdminAnalytics() {
  const router = useRouter();
  const { user, hasHydrated } = useVibeStore();
  
  // Demo Mode State
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityData | null>(null);
  const [cloutEconomy, setCloutEconomy] = useState<CloutEconomy | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('treasury');
  
  // Airdrop Modal
  const [showAirdropModal, setShowAirdropModal] = useState(false);
  const [airdropAmount, setAirdropAmount] = useState('100');
  const [airdropReason, setAirdropReason] = useState('');
  const [selectedScouts, setSelectedScouts] = useState<string[]>([]);
  const [isAirdropping, setIsAirdropping] = useState(false);

  const headers = { 'X-User-Id': user?.id || '' };
  
  // Get data based on demo mode
  const displayTreasury = isDemoMode ? DEMO_TREASURY : treasury;
  const displayLedger = isDemoMode ? DEMO_LEDGER : ledger;
  const displayIntegrity = isDemoMode ? DEMO_INTEGRITY : integrity;
  const displayCloutEconomy = isDemoMode ? DEMO_CLOUT_ECONOMY : cloutEconomy;
  const displayUserAnalytics = isDemoMode ? DEMO_USER_ANALYTICS : userAnalytics;

  const fetchAllData = async () => {
    try {
      // Treasury
      const treasuryRes = await fetch(`${API_URL}/api/admin/treasury`, { headers });
      if (treasuryRes.ok) setTreasury(await treasuryRes.json());
      
      // Pulse Ledger
      const ledgerRes = await fetch(`${API_URL}/api/admin/pulse-ledger`, { headers });
      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setLedger(data.ledger || []);
      }
      
      // Integrity Monitor
      const integrityRes = await fetch(`${API_URL}/api/admin/integrity-monitor`, { headers });
      if (integrityRes.ok) setIntegrity(await integrityRes.json());
      
      // Clout Economy
      const cloutRes = await fetch(`${API_URL}/api/admin/clout-economy`, { headers });
      if (cloutRes.ok) setCloutEconomy(await cloutRes.json());

      // User Analytics (mock for now - TODO: create endpoint)
      const usersRes = await fetch(`${API_URL}/api/admin/user-analytics`, { headers });
      if (usersRes.ok) {
        setUserAnalytics(await usersRes.json());
      } else {
        // Fallback mock data
        setUserAnalytics({
          total_users: treasury?.network_health?.total_users || 0,
          active_users_24h: treasury?.network_health?.active_users_24h || 0,
          active_users_7d: Math.floor((treasury?.network_health?.total_users || 0) * 0.4),
          ghost_users: Math.floor((treasury?.network_health?.total_users || 0) * 0.3),
          ghost_percentage: 30,
          new_users_today: Math.floor(Math.random() * 10) + 2,
          tier_distribution: { elite: 2, scout: 8, regular: 25, newbie: 45 },
        });
      }
      
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHydrated && user?.is_super_admin) {
      fetchAllData();
    } else if (hasHydrated && !user?.is_super_admin) {
      setLoading(false);
    }
  }, [hasHydrated, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, []);

  const handleAirdrop = async () => {
    if (selectedScouts.length === 0) {
      Alert.alert('Error', 'Select at least one scout');
      return;
    }
    
    setIsAirdropping(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/clout-airdrop`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedScouts,
          amount: parseInt(airdropAmount),
          reason: airdropReason || 'Admin bonus',
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        Alert.alert('Success!', result.message);
        setShowAirdropModal(false);
        setSelectedScouts([]);
        setAirdropAmount('100');
        setAirdropReason('');
        fetchAllData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Airdrop failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to airdrop');
    } finally {
      setIsAirdropping(false);
    }
  };

  const toggleScoutSelection = (scoutId: string) => {
    setSelectedScouts(prev => 
      prev.includes(scoutId) 
        ? prev.filter(id => id !== scoutId)
        : [...prev, scoutId]
    );
  };

  const selectAllTopScouts = () => {
    const scouts = isDemoMode ? DEMO_CLOUT_ECONOMY.top_scouts : cloutEconomy?.top_scouts;
    if (scouts) {
      const allIds = scouts.map(s => s.id);
      setSelectedScouts(allIds);
    }
  };

  const getTimeAgo = (isoString: string) => {
    const now = new Date();
    const then = new Date(isoString);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return adminColors.success;
      case 'warning': return adminColors.warning;
      case 'critical': return adminColors.error;
      default: return adminColors.textMuted;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'spark': return '#FF9800';
      case 'flare': return '#E91E63';
      case 'supernova': return '#FFD700';
      default: return adminColors.textMuted;
    }
  };

  if (!hasHydrated || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={adminColors.primary} />
          <Text style={styles.loadingText}>Loading admin analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.is_super_admin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.shieldIcon}>
            <Ionicons name="shield" size={64} color={adminColors.primary} />
          </View>
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>Super Admin privileges required</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[adminColors.primary, adminColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Admin Analytics</Text>
            <Text style={styles.headerSubtitle}>Royal Command Center</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveIndicator} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </LinearGradient>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={[styles.quickStatCard, { borderColor: adminColors.revenue }]}>
            <Ionicons name="cash" size={20} color={adminColors.revenue} />
            <Text style={styles.quickStatValue}>₦{(treasury?.global?.total_revenue || 0).toLocaleString()}</Text>
            <Text style={styles.quickStatLabel}>Total Revenue</Text>
          </View>
          <View style={[styles.quickStatCard, { borderColor: adminColors.users }]}>
            <Ionicons name="people" size={20} color={adminColors.users} />
            <Text style={styles.quickStatValue}>{treasury?.network_health?.total_users || 0}</Text>
            <Text style={styles.quickStatLabel}>Total Users</Text>
          </View>
          <View style={[styles.quickStatCard, { borderColor: adminColors.gold }]}>
            <Ionicons name="flash" size={20} color={adminColors.gold} />
            <Text style={styles.quickStatValue}>{cloutEconomy?.total_clout_circulation?.toLocaleString() || 0}</Text>
            <Text style={styles.quickStatLabel}>Clout</Text>
          </View>
        </View>

        {/* Tab Navigation - Royal Blue Style */}
        <View style={styles.tabNav}>
          {(['treasury', 'venues', 'users', 'logs'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons 
                name={
                  tab === 'treasury' ? 'wallet' : 
                  tab === 'venues' ? 'business' : 
                  tab === 'users' ? 'people' : 'list'
                } 
                size={16} 
                color={activeTab === tab ? adminColors.primary : adminColors.textMuted} 
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ====== TREASURY TAB ====== */}
        {activeTab === 'treasury' && (
          <View style={styles.section}>
            {/* Revenue Summary */}
            <View style={styles.revenueSummary}>
              <View style={styles.revenueMain}>
                <Text style={styles.revenueLabel}>Total Platform Revenue</Text>
                <Text style={styles.revenueValue}>₦{(treasury?.global?.total_revenue || 0).toLocaleString()}</Text>
                <View style={styles.revenueGrowth}>
                  <Ionicons name="trending-up" size={14} color={adminColors.success} />
                  <Text style={styles.revenueGrowthText}>+₦{(treasury?.global?.today_revenue || 0).toLocaleString()} today</Text>
                </View>
              </View>
            </View>

            {/* Most Purchased Tiers Chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Most Purchased Tiers</Text>
              <View style={styles.tiersChart}>
                {treasury?.revenue_by_tier && Object.entries(treasury.revenue_by_tier)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([tier, stats]) => {
                    const maxTotal = Math.max(...Object.values(treasury.revenue_by_tier).map(s => s.total)) || 1;
                    const percentage = (stats.total / maxTotal) * 100;
                    
                    return (
                      <View key={tier} style={styles.tierRow}>
                        <View style={styles.tierInfo}>
                          <View style={[styles.tierBadge, { backgroundColor: getTierColor(tier) + '20' }]}>
                            <Ionicons 
                              name={tier === 'supernova' ? 'star' : tier === 'flare' ? 'flame' : 'flash'} 
                              size={16} 
                              color={getTierColor(tier)} 
                            />
                          </View>
                          <Text style={styles.tierName}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
                        </View>
                        <View style={styles.tierBarContainer}>
                          <View style={[styles.tierBar, { width: `${percentage}%`, backgroundColor: getTierColor(tier) }]} />
                        </View>
                        <View style={styles.tierStats}>
                          <Text style={styles.tierAmount}>₦{stats.total.toLocaleString()}</Text>
                          <Text style={styles.tierCount}>{stats.transactions} drops</Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            </View>

            {/* Transaction Ledger */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pulse Drop Ledger</Text>
              {ledger.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={40} color={adminColors.textMuted} />
                  <Text style={styles.emptyText}>No transactions yet</Text>
                </View>
              ) : (
                <View style={styles.ledgerList}>
                  {ledger.slice(0, 10).map((item) => (
                    <View key={item.drop_id} style={styles.ledgerItem}>
                      <View style={styles.ledgerVenue}>
                        <Text style={styles.ledgerVenueName}>{item.venue_name}</Text>
                        <Text style={styles.ledgerVenueArea}>{item.venue_area}</Text>
                      </View>
                      <View style={styles.ledgerDetails}>
                        <View style={[styles.ledgerTierBadge, { backgroundColor: getTierColor(item.tier) + '20' }]}>
                          <Text style={[styles.ledgerTierText, { color: getTierColor(item.tier) }]}>
                            {item.tier.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.ledgerAmount}>₦{item.amount.toLocaleString()}</Text>
                      </View>
                      <Text style={styles.ledgerTime}>{getTimeAgo(item.created_at)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ====== VENUES TAB (Integrity Monitor) ====== */}
        {activeTab === 'venues' && (
          <View style={styles.section}>
            {/* Integrity Health */}
            <View style={[styles.integrityCard, { borderColor: getHealthColor(integrity?.health_status || 'healthy') }]}>
              <View style={styles.integrityHeader}>
                <Ionicons 
                  name={integrity?.health_status === 'healthy' ? 'checkmark-circle' : 'alert-circle'} 
                  size={28} 
                  color={getHealthColor(integrity?.health_status || 'healthy')} 
                />
                <View style={styles.integrityHeaderText}>
                  <Text style={[styles.integrityStatus, { color: getHealthColor(integrity?.health_status || 'healthy') }]}>
                    Integrity: {integrity?.health_status?.toUpperCase() || 'HEALTHY'}
                  </Text>
                  <Text style={styles.integritySubtext}>
                    {integrity?.health_status === 'healthy' ? 'Platform reputation protected' : 'Review sponsored venues'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Sponsored vs Organic Comparison */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Merchant Claims vs Scout Ratings</Text>
              <View style={styles.comparisonGrid}>
                {/* Sponsored */}
                <View style={styles.comparisonBox}>
                  <Text style={styles.comparisonLabel}>SPONSORED</Text>
                  <Text style={styles.comparisonCount}>{integrity?.sponsored?.count || 0} venues</Text>
                  <View style={[styles.scoreCircle, { borderColor: adminColors.gold }]}>
                    <Text style={[styles.scoreValue, { color: adminColors.gold }]}>
                      {integrity?.sponsored?.average_energy || 0}%
                    </Text>
                  </View>
                  <Text style={styles.scoreLabel}>Avg Energy</Text>
                </View>

                {/* Delta */}
                <View style={styles.deltaBox}>
                  <Ionicons 
                    name={(integrity?.delta || 0) >= 0 ? 'trending-up' : 'trending-down'} 
                    size={28} 
                    color={(integrity?.delta || 0) >= 0 ? adminColors.success : adminColors.error} 
                  />
                  <Text style={[
                    styles.deltaValue,
                    { color: (integrity?.delta || 0) >= 0 ? adminColors.success : adminColors.error }
                  ]}>
                    {(integrity?.delta || 0) >= 0 ? '+' : ''}{integrity?.delta || 0}%
                  </Text>
                </View>

                {/* Organic */}
                <View style={styles.comparisonBox}>
                  <Text style={styles.comparisonLabel}>ORGANIC</Text>
                  <Text style={styles.comparisonCount}>{integrity?.organic?.count || 0} venues</Text>
                  <View style={[styles.scoreCircle, { borderColor: adminColors.success }]}>
                    <Text style={[styles.scoreValue, { color: adminColors.success }]}>
                      {integrity?.organic?.average_energy || 0}%
                    </Text>
                  </View>
                  <Text style={styles.scoreLabel}>Avg Energy</Text>
                </View>
              </View>
            </View>

            {/* Integrity Warnings */}
            {integrity?.integrity_warnings && integrity.integrity_warnings.length > 0 && (
              <View style={styles.warningsCard}>
                <Text style={styles.warningsTitle}>Integrity Warnings</Text>
                {integrity.integrity_warnings.map((warning, idx) => (
                  <View key={idx} style={styles.warningItem}>
                    <Ionicons name="warning" size={16} color={adminColors.warning} />
                    <View style={styles.warningContent}>
                      <Text style={styles.warningVenue}>{warning.venue_name}</Text>
                      <Text style={styles.warningIssue}>{warning.issue}</Text>
                    </View>
                    <Text style={styles.warningScore}>{warning.energy_score}%</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ====== USERS TAB ====== */}
        {activeTab === 'users' && (
          <View style={styles.section}>
            {/* User Overview */}
            <View style={styles.userStatsGrid}>
              <View style={styles.userStatCard}>
                <Ionicons name="people" size={24} color={adminColors.users} />
                <Text style={styles.userStatValue}>{userAnalytics?.total_users || 0}</Text>
                <Text style={styles.userStatLabel}>Total Users</Text>
              </View>
              <View style={styles.userStatCard}>
                <Ionicons name="flash" size={24} color={adminColors.success} />
                <Text style={styles.userStatValue}>{userAnalytics?.active_users_24h || 0}</Text>
                <Text style={styles.userStatLabel}>Active (24h)</Text>
              </View>
              <View style={styles.userStatCard}>
                <Ionicons name="skull" size={24} color={adminColors.textMuted} />
                <Text style={styles.userStatValue}>{userAnalytics?.ghost_users || 0}</Text>
                <Text style={styles.userStatLabel}>Ghost Users</Text>
              </View>
              <View style={styles.userStatCard}>
                <Ionicons name="person-add" size={24} color={adminColors.accent} />
                <Text style={styles.userStatValue}>{userAnalytics?.new_users_today || 0}</Text>
                <Text style={styles.userStatLabel}>New Today</Text>
              </View>
            </View>

            {/* Active vs Ghost Chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Active vs Ghost Users</Text>
              <View style={styles.activeGhostChart}>
                <View style={styles.activeGhostBar}>
                  <View style={[styles.activeSection, { width: `${100 - (userAnalytics?.ghost_percentage || 30)}%` }]} />
                  <View style={[styles.ghostSection, { width: `${userAnalytics?.ghost_percentage || 30}%` }]} />
                </View>
                <View style={styles.activeGhostLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: adminColors.success }]} />
                    <Text style={styles.legendText}>Active ({100 - (userAnalytics?.ghost_percentage || 30)}%)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: adminColors.textMuted }]} />
                    <Text style={styles.legendText}>Ghost ({userAnalytics?.ghost_percentage || 30}%)</Text>
                  </View>
                </View>
                <Text style={styles.ghostNote}>
                  Ghost = Signed up but never rated a venue
                </Text>
              </View>
            </View>

            {/* Clout Economy & Airdrop */}
            <View style={styles.card}>
              <View style={styles.cloutHeader}>
                <Text style={styles.cardTitle}>Global Clout Economy</Text>
                <TouchableOpacity 
                  style={styles.airdropButton}
                  onPress={() => setShowAirdropModal(true)}
                >
                  <Ionicons name="gift" size={14} color="#FFF" />
                  <Text style={styles.airdropButtonText}>Airdrop</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.cloutStats}>
                <View style={styles.cloutStatItem}>
                  <Text style={styles.cloutStatValue}>{cloutEconomy?.total_clout_circulation?.toLocaleString() || 0}</Text>
                  <Text style={styles.cloutStatLabel}>Total Circulation</Text>
                </View>
                <View style={styles.cloutStatItem}>
                  <Text style={styles.cloutStatValue}>{cloutEconomy?.average_clout || 0}</Text>
                  <Text style={styles.cloutStatLabel}>Avg per User</Text>
                </View>
              </View>

              {/* Top Scouts */}
              <Text style={styles.subTitle}>Top 10 Scouts</Text>
              {cloutEconomy?.top_scouts?.slice(0, 5).map((scout) => (
                <View key={scout.id} style={styles.scoutRow}>
                  <Text style={[styles.scoutRank, scout.rank <= 3 && { color: adminColors.gold }]}>
                    #{scout.rank}
                  </Text>
                  <View style={[styles.scoutAvatar, { borderColor: scout.tier_color }]}>
                    <Text style={styles.scoutInitial}>{scout.username?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.scoutInfo}>
                    <Text style={styles.scoutName}>{scout.username}</Text>
                    <Text style={[styles.scoutTier, { color: scout.tier_color }]}>
                      {scout.scout_status} • {scout.total_ratings} ratings
                    </Text>
                  </View>
                  <View style={styles.scoutClout}>
                    <Ionicons name="flash" size={12} color={adminColors.gold} />
                    <Text style={styles.scoutCloutValue}>{scout.clout_points.toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ====== LOGS TAB ====== */}
        {activeTab === 'logs' && (
          <View style={styles.section}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity Logs</Text>
              <View style={styles.logsList}>
                {ledger.slice(0, 15).map((item, index) => (
                  <View key={index} style={styles.logItem}>
                    <View style={styles.logIcon}>
                      <Ionicons name="flash" size={14} color={getTierColor(item.tier)} />
                    </View>
                    <View style={styles.logContent}>
                      <Text style={styles.logText}>
                        <Text style={styles.logVenue}>{item.venue_name}</Text> purchased{' '}
                        <Text style={[styles.logTier, { color: getTierColor(item.tier) }]}>{item.tier}</Text> Pulse Drop
                      </Text>
                      <Text style={styles.logMeta}>
                        ₦{item.amount.toLocaleString()} • {item.ratings_count} ratings • +{item.profile_views_gained} views
                      </Text>
                    </View>
                    <Text style={styles.logTime}>{getTimeAgo(item.created_at)}</Text>
                  </View>
                ))}
                
                {ledger.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={40} color={adminColors.textMuted} />
                    <Text style={styles.emptyText}>No activity logs</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Network Status */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Network Status</Text>
              <View style={styles.networkStatus}>
                <View style={styles.networkItem}>
                  <Ionicons name="wifi" size={20} color={adminColors.success} />
                  <Text style={styles.networkLabel}>Active Connections</Text>
                  <Text style={styles.networkValue}>{treasury?.network_health?.active_connections || 0}</Text>
                </View>
                <View style={styles.networkItem}>
                  <Ionicons name="business" size={20} color={adminColors.venues} />
                  <Text style={styles.networkLabel}>Verified Venues</Text>
                  <Text style={styles.networkValue}>
                    {treasury?.network_health?.verified_venues || 0}/{treasury?.network_health?.total_venues || 0}
                  </Text>
                </View>
                <View style={styles.networkItem}>
                  <Ionicons name="timer" size={20} color={adminColors.accent} />
                  <Text style={styles.networkLabel}>Data Freshness</Text>
                  <Text style={styles.networkValue}>{treasury?.data_freshness_percent || 0}%</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ====== AIRDROP MODAL ====== */}
      <Modal
        visible={showAirdropModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAirdropModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowAirdropModal(false)}
            >
              <Ionicons name="close" size={24} color={adminColors.textMuted} />
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <Ionicons name="gift" size={32} color={adminColors.gold} />
              <Text style={styles.modalTitle}>Clout Airdrop</Text>
              <Text style={styles.modalSubtitle}>Bonus rewards for top scouts</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount per Scout</Text>
              <TextInput
                style={styles.textInput}
                value={airdropAmount}
                onChangeText={setAirdropAmount}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={adminColors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason</Text>
              <TextInput
                style={styles.textInput}
                value={airdropReason}
                onChangeText={setAirdropReason}
                placeholder="e.g., Detty December Bonus"
                placeholderTextColor={adminColors.textMuted}
              />
            </View>

            <View style={styles.scoutSelection}>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionTitle}>Select Scouts ({selectedScouts.length})</Text>
                <TouchableOpacity onPress={selectAllTopScouts}>
                  <Text style={styles.selectAllText}>Select All</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.scoutList} nestedScrollEnabled>
                {cloutEconomy?.top_scouts?.map((scout) => (
                  <TouchableOpacity
                    key={scout.id}
                    style={[
                      styles.scoutSelectRow,
                      selectedScouts.includes(scout.id) && styles.scoutSelectRowActive
                    ]}
                    onPress={() => toggleScoutSelection(scout.id)}
                  >
                    <Ionicons 
                      name={selectedScouts.includes(scout.id) ? 'checkbox' : 'square-outline'} 
                      size={20} 
                      color={selectedScouts.includes(scout.id) ? adminColors.primary : adminColors.textMuted} 
                    />
                    <Text style={styles.scoutSelectName}>{scout.username}</Text>
                    <Text style={styles.scoutSelectClout}>{scout.clout_points} clout</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.airdropPreview}>
              <Text style={styles.previewLabel}>Total Distribution</Text>
              <Text style={styles.previewValue}>
                {selectedScouts.length} × {airdropAmount} = {selectedScouts.length * parseInt(airdropAmount || '0')} Clout
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, (selectedScouts.length === 0 || isAirdropping) && styles.confirmButtonDisabled]}
              onPress={handleAirdrop}
              disabled={selectedScouts.length === 0 || isAirdropping}
            >
              {isAirdropping ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#000" />
                  <Text style={styles.confirmButtonText}>Send Airdrop</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: adminColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: adminColors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  shieldIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: adminColors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: adminColors.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: adminColors.textSecondary,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: adminColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  headerContent: {},
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: adminColors.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: adminColors.cardBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: adminColors.text,
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 10,
    color: adminColors.textMuted,
    marginTop: 4,
  },
  tabNav: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.cardBackground,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  tabActive: {
    borderColor: adminColors.primary,
    backgroundColor: adminColors.primary + '15',
  },
  tabText: {
    fontSize: 12,
    color: adminColors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: adminColors.primary,
  },
  section: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: adminColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: adminColors.text,
    marginBottom: 16,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: adminColors.textSecondary,
    marginTop: 16,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: adminColors.textMuted,
    marginTop: 12,
  },
  
  // Treasury Tab
  revenueSummary: {
    marginBottom: 16,
  },
  revenueMain: {
    backgroundColor: adminColors.primary + '15',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: adminColors.primary + '40',
  },
  revenueLabel: {
    fontSize: 12,
    color: adminColors.primary,
    fontWeight: '600',
  },
  revenueValue: {
    fontSize: 36,
    fontWeight: '900',
    color: adminColors.text,
    marginTop: 8,
  },
  revenueGrowth: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  revenueGrowthText: {
    fontSize: 13,
    color: adminColors.success,
    fontWeight: '600',
  },
  tiersChart: {
    gap: 16,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  tierBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tierName: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.text,
  },
  tierBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: adminColors.inputBackground,
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  tierBar: {
    height: '100%',
    borderRadius: 4,
  },
  tierStats: {
    width: 80,
    alignItems: 'flex-end',
  },
  tierAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: adminColors.text,
  },
  tierCount: {
    fontSize: 10,
    color: adminColors.textMuted,
  },
  ledgerList: {
    gap: 12,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  ledgerVenue: {
    flex: 1,
  },
  ledgerVenueName: {
    fontSize: 14,
    fontWeight: '600',
    color: adminColors.text,
  },
  ledgerVenueArea: {
    fontSize: 11,
    color: adminColors.textMuted,
    marginTop: 2,
  },
  ledgerDetails: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  ledgerTierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  ledgerTierText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ledgerAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: adminColors.success,
  },
  ledgerTime: {
    fontSize: 11,
    color: adminColors.textMuted,
    width: 50,
    textAlign: 'right',
  },

  // Venues Tab (Integrity)
  integrityCard: {
    backgroundColor: adminColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  integrityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  integrityHeaderText: {
    flex: 1,
  },
  integrityStatus: {
    fontSize: 16,
    fontWeight: '700',
  },
  integritySubtext: {
    fontSize: 12,
    color: adminColors.textMuted,
    marginTop: 4,
  },
  comparisonGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: adminColors.textMuted,
    letterSpacing: 1,
  },
  comparisonCount: {
    fontSize: 11,
    color: adminColors.textMuted,
    marginTop: 4,
  },
  scoreCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: adminColors.inputBackground,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  scoreLabel: {
    fontSize: 10,
    color: adminColors.textMuted,
  },
  deltaBox: {
    width: 60,
    alignItems: 'center',
  },
  deltaValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  warningsCard: {
    backgroundColor: adminColors.warning + '15',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: adminColors.warning + '40',
  },
  warningsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: adminColors.warning,
    marginBottom: 12,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  warningContent: {
    flex: 1,
  },
  warningVenue: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.text,
  },
  warningIssue: {
    fontSize: 11,
    color: adminColors.textMuted,
    marginTop: 2,
  },
  warningScore: {
    fontSize: 14,
    fontWeight: '700',
    color: adminColors.warning,
  },

  // Users Tab
  userStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  userStatCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: adminColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  userStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: adminColors.text,
    marginTop: 8,
  },
  userStatLabel: {
    fontSize: 11,
    color: adminColors.textMuted,
    marginTop: 4,
  },
  activeGhostChart: {
    marginTop: 8,
  },
  activeGhostBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  activeSection: {
    backgroundColor: adminColors.success,
  },
  ghostSection: {
    backgroundColor: adminColors.textMuted,
  },
  activeGhostLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: adminColors.textSecondary,
  },
  ghostNote: {
    fontSize: 11,
    color: adminColors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  airdropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: adminColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  airdropButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  cloutStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
    marginBottom: 16,
  },
  cloutStatItem: {
    alignItems: 'center',
  },
  cloutStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: adminColors.gold,
  },
  cloutStatLabel: {
    fontSize: 11,
    color: adminColors.textMuted,
    marginTop: 4,
  },
  scoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  scoutRank: {
    width: 30,
    fontSize: 14,
    fontWeight: '700',
    color: adminColors.textSecondary,
  },
  scoutAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: adminColors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: 12,
  },
  scoutInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: adminColors.text,
  },
  scoutInfo: {
    flex: 1,
  },
  scoutName: {
    fontSize: 14,
    fontWeight: '600',
    color: adminColors.text,
  },
  scoutTier: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  scoutClout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoutCloutValue: {
    fontSize: 14,
    fontWeight: '700',
    color: adminColors.gold,
  },

  // Logs Tab
  logsList: {
    gap: 4,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  logIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: adminColors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logContent: {
    flex: 1,
  },
  logText: {
    fontSize: 13,
    color: adminColors.textSecondary,
    lineHeight: 18,
  },
  logVenue: {
    color: adminColors.text,
    fontWeight: '600',
  },
  logTier: {
    fontWeight: '700',
  },
  logMeta: {
    fontSize: 11,
    color: adminColors.textMuted,
    marginTop: 4,
  },
  logTime: {
    fontSize: 11,
    color: adminColors.textMuted,
    marginLeft: 8,
  },
  networkStatus: {
    gap: 12,
  },
  networkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  networkLabel: {
    flex: 1,
    fontSize: 14,
    color: adminColors.textSecondary,
    marginLeft: 12,
  },
  networkValue: {
    fontSize: 16,
    fontWeight: '700',
    color: adminColors.text,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: adminColors.cardBackground,
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: adminColors.text,
    marginTop: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: adminColors.textMuted,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: adminColors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: adminColors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  scoutSelection: {
    marginBottom: 16,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.textSecondary,
  },
  selectAllText: {
    fontSize: 13,
    color: adminColors.primary,
    fontWeight: '600',
  },
  scoutList: {
    maxHeight: 140,
    backgroundColor: adminColors.inputBackground,
    borderRadius: 8,
    padding: 8,
  },
  scoutSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 10,
  },
  scoutSelectRowActive: {
    backgroundColor: adminColors.primary + '20',
  },
  scoutSelectName: {
    flex: 1,
    fontSize: 13,
    color: adminColors.text,
  },
  scoutSelectClout: {
    fontSize: 11,
    color: adminColors.textMuted,
  },
  airdropPreview: {
    backgroundColor: adminColors.inputBackground,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 11,
    color: adminColors.textMuted,
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: adminColors.gold,
    marginTop: 4,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.gold,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: adminColors.inputBackground,
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
});
