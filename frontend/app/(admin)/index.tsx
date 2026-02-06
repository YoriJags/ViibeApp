/**
 * ADMIN FLOOR - Macro-Vibe Analytics Dashboard
 * Features:
 * - Treasury Ledger (Pulse Drop transactions)
 * - Integrity Monitor (Sponsored vs Organic energy comparison)
 * - Global Clout Economy (Total clout, Top Scouts, Airdrop)
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { adminTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';
import { useResponsive } from '../../src/utils/responsive';

const { colors } = adminTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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
  tier_distribution: Record<string, { count: number; clout: number }>;
}

interface TreasuryData {
  global: { total_revenue: number; today_revenue: number };
  network_health: { active_connections: number; total_venues: number; total_users: number; active_users_24h: number };
  data_freshness_percent: number;
}

export default function AdminAnalytics() {
  const { isDesktop, isTablet } = useResponsive();
  const { user } = useVibeStore();
  
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityData | null>(null);
  const [cloutEconomy, setCloutEconomy] = useState<CloutEconomy | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'treasury' | 'integrity' | 'clout'>('treasury');
  
  // Airdrop Modal
  const [showAirdropModal, setShowAirdropModal] = useState(false);
  const [airdropAmount, setAirdropAmount] = useState('100');
  const [airdropReason, setAirdropReason] = useState('');
  const [selectedScouts, setSelectedScouts] = useState<string[]>([]);
  const [isAirdropping, setIsAirdropping] = useState(false);

  const headers = { 'X-User-Id': user?.id || '' };

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
      
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_super_admin) {
      fetchAllData();
    }
  }, [user?.id]);

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
        Alert.alert('🎉 Success!', result.message);
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
    if (cloutEconomy?.top_scouts) {
      const allIds = cloutEconomy.top_scouts.map(s => s.id);
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
      case 'healthy': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'critical': return '#FF5252';
      default: return '#888';
    }
  };

  const containerStyle = isDesktop ? {
    maxWidth: 1200,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: spacing.xxl,
  } : {};

  if (!user?.is_super_admin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="shield" size={64} color={colors.primary} />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>Super Admin privileges required</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading admin analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={containerStyle}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Macro-Vibe Analytics</Text>
          <Text style={styles.headerSubtitle}>God View Command Center</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatCard}>
            <Ionicons name="cash" size={24} color="#4CAF50" />
            <Text style={styles.quickStatValue}>₦{(treasury?.global?.total_revenue || 0).toLocaleString()}</Text>
            <Text style={styles.quickStatLabel}>Total Revenue</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Ionicons name="people" size={24} color="#00D4FF" />
            <Text style={styles.quickStatValue}>{treasury?.network_health?.total_users || 0}</Text>
            <Text style={styles.quickStatLabel}>Total Users</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Ionicons name="flash" size={24} color="#FFD700" />
            <Text style={styles.quickStatValue}>{cloutEconomy?.total_clout_circulation?.toLocaleString() || 0}</Text>
            <Text style={styles.quickStatLabel}>Clout Circulation</Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          {(['treasury', 'integrity', 'clout'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons 
                name={tab === 'treasury' ? 'receipt' : tab === 'integrity' ? 'shield-checkmark' : 'flash'} 
                size={16} 
                color={activeTab === tab ? colors.primary : colors.textMuted} 
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'treasury' ? 'Treasury Ledger' : tab === 'integrity' ? 'Integrity' : 'Clout Economy'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ====== TREASURY LEDGER ====== */}
        {activeTab === 'treasury' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📒 Pulse Drop Transactions</Text>
            <Text style={styles.sectionSubtitle}>All revenue from Pulse Drops with scout activity</Text>
            
            {ledger.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No Pulse Drop transactions yet</Text>
              </View>
            ) : (
              <View style={styles.ledgerTable}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Venue</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amount</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Time</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Scout Activity</Text>
                </View>
                
                {/* Table Rows */}
                {ledger.map((item) => (
                  <View key={item.drop_id} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.venueName}>{item.venue_name}</Text>
                      <View style={styles.venueScoreBadge}>
                        <Text style={[
                          styles.venueScoreText,
                          { color: item.current_vibe_score >= 60 ? '#4CAF50' : item.current_vibe_score >= 40 ? '#FF9800' : '#FF5252' }
                        ]}>
                          {item.current_vibe_score}% Energy
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.amountText}>₦{item.amount.toLocaleString()}</Text>
                      <Text style={styles.tierBadge}>{item.tier.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeText}>{getTimeAgo(item.created_at)}</Text>
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.activityText}>{item.scout_activity}</Text>
                      <Text style={styles.activityDetail}>
                        +{item.profile_views_gained} views • +{item.direction_clicks_gained} clicks
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ====== INTEGRITY MONITOR ====== */}
        {activeTab === 'integrity' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛡️ Integrity Monitor</Text>
            <Text style={styles.sectionSubtitle}>Sponsored vs Organic Energy Comparison</Text>
            
            {/* Health Status */}
            <View style={[styles.healthCard, { borderColor: getHealthColor(integrity?.health_status || 'healthy') }]}>
              <View style={styles.healthHeader}>
                <Ionicons 
                  name={integrity?.health_status === 'healthy' ? 'checkmark-circle' : 'warning'} 
                  size={24} 
                  color={getHealthColor(integrity?.health_status || 'healthy')} 
                />
                <Text style={[styles.healthTitle, { color: getHealthColor(integrity?.health_status || 'healthy') }]}>
                  {integrity?.health_status?.toUpperCase() || 'HEALTHY'}
                </Text>
              </View>
              <Text style={styles.healthSubtext}>
                App reputation is {integrity?.health_status === 'healthy' ? 'protected' : 'at risk - review sponsored venues'}
              </Text>
            </View>

            {/* Comparison Chart */}
            <View style={styles.comparisonRow}>
              {/* Sponsored */}
              <View style={styles.comparisonCard}>
                <Text style={styles.comparisonLabel}>SPONSORED</Text>
                <Text style={styles.comparisonCount}>{integrity?.sponsored?.count || 0} venues</Text>
                <View style={styles.avgScoreCircle}>
                  <Text style={[styles.avgScoreValue, { color: '#FFD700' }]}>
                    {integrity?.sponsored?.average_energy || 0}%
                  </Text>
                </View>
                <Text style={styles.avgScoreLabel}>Avg Energy</Text>
                
                {/* Distribution */}
                <View style={styles.distributionRow}>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#FF3366' }]} />
                    <Text style={styles.distText}>{integrity?.sponsored?.distribution?.electric || 0}</Text>
                  </View>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#FF9933' }]} />
                    <Text style={styles.distText}>{integrity?.sponsored?.distribution?.popping || 0}</Text>
                  </View>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#9933FF' }]} />
                    <Text style={styles.distText}>{integrity?.sponsored?.distribution?.moderate || 0}</Text>
                  </View>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#3399FF' }]} />
                    <Text style={styles.distText}>{integrity?.sponsored?.distribution?.quiet || 0}</Text>
                  </View>
                </View>
              </View>

              {/* Delta */}
              <View style={styles.deltaCard}>
                <Ionicons 
                  name={(integrity?.delta || 0) >= 0 ? 'trending-up' : 'trending-down'} 
                  size={32} 
                  color={(integrity?.delta || 0) >= 0 ? '#4CAF50' : '#FF5252'} 
                />
                <Text style={[
                  styles.deltaValue,
                  { color: (integrity?.delta || 0) >= 0 ? '#4CAF50' : '#FF5252' }
                ]}>
                  {(integrity?.delta || 0) >= 0 ? '+' : ''}{integrity?.delta || 0}%
                </Text>
                <Text style={styles.deltaLabel}>Delta</Text>
              </View>

              {/* Organic */}
              <View style={styles.comparisonCard}>
                <Text style={styles.comparisonLabel}>ORGANIC</Text>
                <Text style={styles.comparisonCount}>{integrity?.organic?.count || 0} venues</Text>
                <View style={styles.avgScoreCircle}>
                  <Text style={[styles.avgScoreValue, { color: '#4CAF50' }]}>
                    {integrity?.organic?.average_energy || 0}%
                  </Text>
                </View>
                <Text style={styles.avgScoreLabel}>Avg Energy</Text>
                
                {/* Distribution */}
                <View style={styles.distributionRow}>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#FF3366' }]} />
                    <Text style={styles.distText}>{integrity?.organic?.distribution?.electric || 0}</Text>
                  </View>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#FF9933' }]} />
                    <Text style={styles.distText}>{integrity?.organic?.distribution?.popping || 0}</Text>
                  </View>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#9933FF' }]} />
                    <Text style={styles.distText}>{integrity?.organic?.distribution?.moderate || 0}</Text>
                  </View>
                  <View style={styles.distItem}>
                    <View style={[styles.distDot, { backgroundColor: '#3399FF' }]} />
                    <Text style={styles.distText}>{integrity?.organic?.distribution?.quiet || 0}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Integrity Warnings */}
            {integrity?.integrity_warnings && integrity.integrity_warnings.length > 0 && (
              <View style={styles.warningsSection}>
                <Text style={styles.warningsTitle}>⚠️ Integrity Warnings</Text>
                {integrity.integrity_warnings.map((warning, idx) => (
                  <View key={idx} style={styles.warningItem}>
                    <Ionicons name="alert-circle" size={16} color="#FF9800" />
                    <View style={styles.warningContent}>
                      <Text style={styles.warningVenue}>{warning.venue_name}</Text>
                      <Text style={styles.warningText}>{warning.energy_score}% - {warning.issue}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ====== CLOUT ECONOMY ====== */}
        {activeTab === 'clout' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Global Clout Economy</Text>
            <Text style={styles.sectionSubtitle}>Total clout circulation and top scouts</Text>
            
            {/* Stats Row */}
            <View style={styles.cloutStatsRow}>
              <View style={styles.cloutStatCard}>
                <Text style={styles.cloutStatValue}>{cloutEconomy?.total_clout_circulation?.toLocaleString() || 0}</Text>
                <Text style={styles.cloutStatLabel}>Total Circulation</Text>
              </View>
              <View style={styles.cloutStatCard}>
                <Text style={styles.cloutStatValue}>{cloutEconomy?.total_users || 0}</Text>
                <Text style={styles.cloutStatLabel}>Total Users</Text>
              </View>
              <View style={styles.cloutStatCard}>
                <Text style={styles.cloutStatValue}>{cloutEconomy?.average_clout || 0}</Text>
                <Text style={styles.cloutStatLabel}>Avg per User</Text>
              </View>
            </View>

            {/* Top 10 Scouts */}
            <View style={styles.topScoutsSection}>
              <View style={styles.topScoutsHeader}>
                <Text style={styles.topScoutsTitle}>🏆 Top 10 Scouts - Lagos</Text>
                <TouchableOpacity 
                  style={styles.airdropButton}
                  onPress={() => setShowAirdropModal(true)}
                >
                  <Ionicons name="gift" size={16} color="#FFF" />
                  <Text style={styles.airdropButtonText}>Airdrop Clout</Text>
                </TouchableOpacity>
              </View>

              {cloutEconomy?.top_scouts?.map((scout) => (
                <View key={scout.id} style={styles.scoutRow}>
                  <View style={styles.scoutRank}>
                    <Text style={[styles.scoutRankText, scout.rank <= 3 && { color: '#FFD700' }]}>
                      #{scout.rank}
                    </Text>
                  </View>
                  <View style={[styles.scoutAvatar, { borderColor: scout.tier_color }]}>
                    <Text style={styles.scoutInitial}>{scout.username?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.scoutInfo}>
                    <Text style={styles.scoutName}>{scout.username}</Text>
                    <Text style={[styles.scoutTier, { color: scout.tier_color }]}>
                      {scout.scout_status?.toUpperCase()} • {scout.total_ratings} ratings
                    </Text>
                  </View>
                  <View style={styles.scoutClout}>
                    <Ionicons name="flash" size={14} color="#FFD700" />
                    <Text style={styles.scoutCloutValue}>{scout.clout_points.toLocaleString()}</Text>
                  </View>
                </View>
              ))}
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
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <Ionicons name="gift" size={32} color="#FFD700" />
              <Text style={styles.modalTitle}>Clout Airdrop</Text>
              <Text style={styles.modalSubtitle}>Bonus rewards for top scouts (e.g., Detty December)</Text>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Clout Amount (per scout)</Text>
              <TextInput
                style={styles.textInput}
                value={airdropAmount}
                onChangeText={setAirdropAmount}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor="#666"
              />
            </View>

            {/* Reason Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason</Text>
              <TextInput
                style={styles.textInput}
                value={airdropReason}
                onChangeText={setAirdropReason}
                placeholder="e.g., Detty December Bonus"
                placeholderTextColor="#666"
              />
            </View>

            {/* Scout Selection */}
            <View style={styles.scoutSelection}>
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionTitle}>Select Scouts ({selectedScouts.length})</Text>
                <TouchableOpacity onPress={selectAllTopScouts}>
                  <Text style={styles.selectAllText}>Select All</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.scoutList}>
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
                      color={selectedScouts.includes(scout.id) ? colors.primary : '#666'} 
                    />
                    <Text style={styles.scoutSelectName}>{scout.username}</Text>
                    <Text style={styles.scoutSelectClout}>{scout.clout_points} clout</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Preview */}
            <View style={styles.airdropPreview}>
              <Text style={styles.previewLabel}>Total Distribution</Text>
              <Text style={styles.previewValue}>
                {selectedScouts.length} × {airdropAmount} = {selectedScouts.length * parseInt(airdropAmount || '0')} Clout
              </Text>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.confirmButton, (selectedScouts.length === 0 || isAirdropping) && styles.confirmButtonDisabled]}
              onPress={handleAirdrop}
              disabled={selectedScouts.length === 0 || isAirdropping}
            >
              {isAirdropping ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#000" />
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  header: {
    padding: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black,
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  quickStatLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  tabNav: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  tabText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.semibold,
  },
  tabTextActive: {
    color: colors.primary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  
  // Treasury Ledger
  ledgerTable: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  venueName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  venueScoreBadge: {
    marginTop: 2,
  },
  venueScoreText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  amountText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: '#4CAF50',
  },
  tierBadge: {
    fontSize: 9,
    color: '#FFD700',
    fontWeight: typography.fontWeight.bold,
    marginTop: 2,
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  activityText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  activityDetail: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  
  // Integrity Monitor
  healthCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  healthTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  healthSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  comparisonCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  comparisonCount: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  avgScoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  avgScoreValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black,
  },
  avgScoreLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  distributionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  distItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  distText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  deltaCard: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deltaValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black,
  },
  deltaLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  warningsSection: {
    backgroundColor: '#FF980020',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FF980050',
  },
  warningsTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FF9800',
    marginBottom: spacing.md,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  warningContent: {
    flex: 1,
  },
  warningVenue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  warningText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  
  // Clout Economy
  cloutStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cloutStatCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cloutStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    color: '#FFD700',
  },
  cloutStatLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  topScoutsSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topScoutsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  topScoutsTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  airdropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  airdropButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  scoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoutRank: {
    width: 30,
  },
  scoutRankText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  scoutAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: spacing.md,
  },
  scoutInitial: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  scoutInfo: {
    flex: 1,
  },
  scoutName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  scoutTier: {
    fontSize: 10,
    marginTop: 2,
  },
  scoutClout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoutCloutValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFD700',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  modalClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: typography.fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoutSelection: {
    marginBottom: spacing.md,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  selectAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
  scoutList: {
    maxHeight: 150,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  scoutSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  scoutSelectRowActive: {
    backgroundColor: colors.primary + '20',
  },
  scoutSelectName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  scoutSelectClout: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  airdropPreview: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  previewLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  previewValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#FFD700',
    marginTop: 4,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  confirmButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#000',
  },
});
