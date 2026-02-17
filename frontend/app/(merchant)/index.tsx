/**
 * MERCHANT FLOOR - Dashboard (Level 1)
 * Non-Competitive: Only shows YOUR venue data
 * Features:
 * - Live Energy Score & Scout Count
 * - Vibe Sentiment (Gate/Queue, Capacity)
 * - Content Management (Entry Fee, Music, Tables)
 * - Pulse Drop with Countdown Timer
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
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { merchantTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';
import VibeIntelCard from '../../src/components/VibeIntelCard';
import VibeForecast from '../../src/components/VibeForecast';
import CreateCampaignModal from '../../src/components/CreateCampaignModal';
import MerchantOnboarding from '../../src/components/MerchantOnboarding';
import DemoModeBanner from '../../src/components/DemoModeBanner';
import FloorSwitcher from '../../src/components/FloorSwitcher';
import {
  DEMO_VENUE_STATS,
  DEMO_SENTIMENT,
  DEMO_PULSE_STATUS,
  DEMO_ACTIVE_CAMPAIGN,
} from '../../src/data/demoData';

const { colors } = merchantTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VenueStats {
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
  wallet_balance: number;
}

interface Sentiment {
  sentiment: {
    gate: { dominant: string; wait_estimate: string; percentage: number };
    capacity: { dominant: string; percentage: number };
    energy: { dominant: string; percentage: number };
  };
  total_checks_24h: number;
}

interface PulseStatus {
  is_active: boolean;
  current_tier: string | null;
  time_remaining: { hours: number; minutes: number; seconds: number; total_seconds: number } | null;
  available_tiers: Record<string, { price: number; duration_hours: number; glow_boost: number }>;
}

export default function MerchantDashboard() {
  const router = useRouter();
  const { user, getAuthHeaders, hasSeenMerchantOnboarding, completeMerchantOnboarding, isDemoMode } = useVibeStore();
  const [stats, setStats] = useState<VenueStats | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [pulseStatus, setPulseStatus] = useState<PulseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Content Management State
  const [entryFee, setEntryFee] = useState('');
  const [musicGenre, setMusicGenre] = useState('');
  const [tablesAvailable, setTablesAvailable] = useState(true);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  // Pulse Drop State
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isActivatingPulse, setIsActivatingPulse] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  // Campaign State
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<any>(null);

  const fetchAllData = async () => {
    // In demo mode, use mock data instead of API calls
    if (isDemoMode) {
      setStats(DEMO_VENUE_STATS as any);
      setSentiment(DEMO_SENTIMENT as any);
      setPulseStatus(DEMO_PULSE_STATUS as any);
      setActiveCampaign(DEMO_ACTIVE_CAMPAIGN as any);
      setEntryFee(DEMO_VENUE_STATS.venue.entry_fee || '5,000');
      setMusicGenre(DEMO_VENUE_STATS.venue.music_genre || 'Afrobeats / Amapiano');
      setTablesAvailable(true);
      setGeofenceRadius(DEMO_VENUE_STATS.venue.geofence_radius_m || 150);
      setLoading(false);
      return;
    }

    if (!user?.merchant_venue_id) return;

    const headers = getAuthHeaders();

    try {
      // Fetch stats
      const statsRes = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/stats`,
        { headers }
      );
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
        setEntryFee(data.venue?.entry_fee || '');
        setMusicGenre(data.venue?.music_genre || '');
        setTablesAvailable(data.venue?.tables_available ?? true);
        setGeofenceRadius(data.venue?.geofence_radius_m ?? 100);
      }
      
      // Fetch sentiment
      const sentimentRes = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/sentiment`,
        { headers }
      );
      if (sentimentRes.ok) {
        setSentiment(await sentimentRes.json());
      }
      
      // Fetch pulse status
      const pulseRes = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/pulse-status`,
        { headers }
      );
      if (pulseRes.ok) {
        setPulseStatus(await pulseRes.json());
      }

      // Fetch active campaign
      const campaignRes = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/campaigns`,
        { headers }
      );
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json();
        const active = (campaignData.campaigns || []).find((c: any) => c.status === 'active');
        setActiveCampaign(active || null);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user?.merchant_venue_id]);

  // Countdown timer
  useEffect(() => {
    if (pulseStatus?.is_active && pulseStatus.time_remaining) {
      const interval = setInterval(() => {
        const { hours, minutes, seconds, total_seconds } = pulseStatus.time_remaining!;
        if (total_seconds <= 0) {
          setCountdown('Expired');
          fetchAllData(); // Refresh status
        } else {
          setCountdown(`${hours}h ${minutes}m ${seconds}s`);
          pulseStatus.time_remaining!.total_seconds -= 1;
          if (pulseStatus.time_remaining!.seconds > 0) {
            pulseStatus.time_remaining!.seconds -= 1;
          } else if (pulseStatus.time_remaining!.minutes > 0) {
            pulseStatus.time_remaining!.minutes -= 1;
            pulseStatus.time_remaining!.seconds = 59;
          } else if (pulseStatus.time_remaining!.hours > 0) {
            pulseStatus.time_remaining!.hours -= 1;
            pulseStatus.time_remaining!.minutes = 59;
            pulseStatus.time_remaining!.seconds = 59;
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pulseStatus?.is_active, pulseStatus?.time_remaining]);

  const onRefresh = useCallback(async () => {
    if (isDemoMode) return;
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, [user?.merchant_venue_id, isDemoMode]);

  const handleSaveContent = async () => {
    if (isDemoMode) {
      Alert.alert('Demo Mode', 'Changes are simulated in demo mode.');
      setShowEditForm(false);
      return;
    }
    if (!user?.merchant_venue_id) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/update`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            entry_fee: entryFee,
            music_genre: musicGenre,
            tables_available: tablesAvailable,
            geofence_radius_m: geofenceRadius,
          }),
        }
      );
      
      if (response.ok) {
        Alert.alert('✅ Updated!', 'Changes are now live on the public floor.');
        setShowEditForm(false);
        fetchAllData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to update');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivatePulse = async (tier: string) => {
    if (isDemoMode) {
      Alert.alert('Demo Mode', `${tier.toUpperCase()} Pulse simulated in demo mode.`);
      setSelectedTier(null);
      return;
    }
    if (!user?.merchant_venue_id) return;

    setIsActivatingPulse(true);
    try {
      const response = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/pulse-drop?tier=${tier}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );

      if (response.ok) {
        const result = await response.json();
        Alert.alert('🚀 Pulse Activated!', result.message);
        fetchAllData();
        setSelectedTier(null);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to activate Pulse Drop');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to activate Pulse Drop');
    } finally {
      setIsActivatingPulse(false);
    }
  };

  const getEnergyColor = (score: number) => {
    if (score >= 80) return '#FF3366';
    if (score >= 60) return '#FF9933';
    if (score >= 40) return '#9933FF';
    return '#3399FF';
  };

  if (!user?.merchant_venue_id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="business" size={64} color={colors.textMuted} />
          <Text style={styles.errorTitle}>No Venue Linked</Text>
          <Text style={styles.errorText}>Your account is not linked to a venue.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vibeScore = stats?.venue?.current_vibe_score || 0;
  const vibeColor = getEnergyColor(vibeScore);

  return (
    <SafeAreaView style={styles.container}>
      <DemoModeBanner />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Glowed-Up Header */}
        <LinearGradient
          colors={['#1A1510', '#0D0D0A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View>
            <Text style={styles.welcomeText}>Your Venue</Text>
            <Text style={styles.venueName}>{stats?.venue?.name}</Text>
          </View>
          <LinearGradient
            colors={['#D4AF3730', '#D4AF3710']}
            style={styles.walletBadge}
          >
            <Ionicons name="wallet" size={16} color={colors.success} />
            <Text style={styles.walletBalance}>{'\u20A6'}{(stats?.wallet_balance || 0).toLocaleString()}</Text>
          </LinearGradient>
        </LinearGradient>

        {/* ====== LIVE PERFORMANCE METRICS ====== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Live Performance</Text>
          
          {/* Main Score Card — Glow-Up */}
          <LinearGradient
            colors={['#1A1510', vibeColor + '08']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scoreCard}
          >
            <View style={styles.scoreMainRow}>
              <View style={[styles.scoreCircle, { borderColor: vibeColor + '40', shadowColor: vibeColor }]}>
                <Text style={[styles.scoreValue, { color: vibeColor }]}>{Math.round(vibeScore)}%</Text>
                <Text style={styles.scoreLabel}>ENERGY</Text>
              </View>
              <View style={styles.scoreMetrics}>
                <View style={styles.metricRow}>
                  <Ionicons name="people" size={18} color={colors.accent} />
                  <Text style={styles.metricValue}>{stats?.stats?.ratings_24h || 0}</Text>
                  <Text style={styles.metricLabel}>Scouts Today</Text>
                </View>
                <View style={styles.metricRow}>
                  <Ionicons name="eye" size={18} color="#00D4FF" />
                  <Text style={styles.metricValue}>{stats?.stats?.profile_views || 0}</Text>
                  <Text style={styles.metricLabel}>Profile Views</Text>
                </View>
                <View style={styles.metricRow}>
                  <Ionicons name="navigate" size={18} color="#4CAF50" />
                  <Text style={styles.metricValue}>{stats?.stats?.direction_clicks || 0}</Text>
                  <Text style={styles.metricLabel}>Directions</Text>
                </View>
              </View>
            </View>
            
            {/* Delta Badge */}
            <View style={[
              styles.deltaBadge,
              { backgroundColor: (stats?.heatmap_delta?.delta || 0) >= 0 ? '#4CAF5020' : '#FF525220' }
            ]}>
              <Ionicons 
                name={(stats?.heatmap_delta?.delta || 0) >= 0 ? 'trending-up' : 'trending-down'} 
                size={14} 
                color={(stats?.heatmap_delta?.delta || 0) >= 0 ? '#4CAF50' : '#FF5252'} 
              />
              <Text style={[
                styles.deltaText,
                { color: (stats?.heatmap_delta?.delta || 0) >= 0 ? '#4CAF50' : '#FF5252' }
              ]}>
                {(stats?.heatmap_delta?.delta || 0) >= 0 ? '+' : ''}{stats?.heatmap_delta?.delta || 0}% vs district avg
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* ====== VIBE SENTIMENT ====== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 Vibe Sentiment</Text>
          <Text style={styles.sectionSubtitle}>{sentiment?.total_checks_24h || 0} checks in last 24h</Text>
          
          <View style={styles.sentimentGrid}>
            {/* Gate/Queue */}
            <View style={styles.sentimentCard}>
              <View style={styles.sentimentHeader}>
                <Ionicons name="enter-outline" size={20} color="#FF9933" />
                <Text style={styles.sentimentTitle}>Gate / Queue</Text>
              </View>
              <Text style={styles.sentimentValue}>
                {sentiment?.sentiment?.gate?.dominant?.toUpperCase() || 'N/A'}
              </Text>
              <Text style={styles.sentimentSubvalue}>
                {sentiment?.sentiment?.gate?.wait_estimate || 'No data'}
              </Text>
              <View style={styles.sentimentBar}>
                <View style={[styles.sentimentBarFill, { width: `${sentiment?.sentiment?.gate?.percentage || 0}%`, backgroundColor: '#FF9933' }]} />
              </View>
            </View>

            {/* Capacity */}
            <View style={styles.sentimentCard}>
              <View style={styles.sentimentHeader}>
                <Ionicons name="people-outline" size={20} color="#00D4FF" />
                <Text style={styles.sentimentTitle}>Capacity</Text>
              </View>
              <Text style={styles.sentimentValue}>
                {sentiment?.sentiment?.capacity?.dominant?.toUpperCase() || 'N/A'}
              </Text>
              <Text style={styles.sentimentSubvalue}>
                {sentiment?.sentiment?.capacity?.percentage || 0}% of ratings
              </Text>
              <View style={styles.sentimentBar}>
                <View style={[styles.sentimentBarFill, { width: `${sentiment?.sentiment?.capacity?.percentage || 0}%`, backgroundColor: '#00D4FF' }]} />
              </View>
            </View>

            {/* Energy */}
            <View style={styles.sentimentCard}>
              <View style={styles.sentimentHeader}>
                <Ionicons name="flash-outline" size={20} color="#FF3366" />
                <Text style={styles.sentimentTitle}>Energy</Text>
              </View>
              <Text style={styles.sentimentValue}>
                {sentiment?.sentiment?.energy?.dominant?.toUpperCase() || 'N/A'}
              </Text>
              <Text style={styles.sentimentSubvalue}>
                {sentiment?.sentiment?.energy?.percentage || 0}% of ratings
              </Text>
              <View style={styles.sentimentBar}>
                <View style={[styles.sentimentBarFill, { width: `${sentiment?.sentiment?.energy?.percentage || 0}%`, backgroundColor: '#FF3366' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* ====== CONTENT MANAGEMENT ====== */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📝 Live Update</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setShowEditForm(!showEditForm)}
            >
              <Ionicons name={showEditForm ? 'close' : 'pencil'} size={16} color={colors.accent} />
              <Text style={styles.editButtonText}>{showEditForm ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>Changes reflect instantly on the public floor</Text>
          
          {showEditForm ? (
            <View style={styles.editForm}>
              {/* Entry Fee */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Entry Fee</Text>
                <TextInput
                  style={styles.textInput}
                  value={entryFee}
                  onChangeText={setEntryFee}
                  placeholder="e.g., ₦10,000, Free Entry"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              
              {/* Music Genre */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Music Genre</Text>
                <TextInput
                  style={styles.textInput}
                  value={musicGenre}
                  onChangeText={setMusicGenre}
                  placeholder="e.g., Amapiano, Afrobeats, House"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              
              {/* Tables Available */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.inputLabel}>Tables Available</Text>
                  <Text style={styles.switchSubtext}>Toggle to update availability</Text>
                </View>
                <Switch
                  value={tablesAvailable}
                  onValueChange={setTablesAvailable}
                  trackColor={{ false: '#333', true: colors.accent + '60' }}
                  thumbColor={tablesAvailable ? colors.accent : '#666'}
                />
              </View>

              {/* Geofence Radius */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Geofence Radius</Text>
                <Text style={styles.switchSubtext}>How close scouts must be to rate (in meters)</Text>
                <View style={styles.radiusOptions}>
                  {[50, 100, 150, 200].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.radiusChip,
                        geofenceRadius === r && styles.radiusChipActive,
                      ]}
                      onPress={() => setGeofenceRadius(r)}
                    >
                      <Text style={[
                        styles.radiusChipText,
                        geofenceRadius === r && styles.radiusChipTextActive,
                      ]}>
                        {r}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveContent}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>Save & Publish</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contentPreview}>
              <View style={styles.previewRow}>
                <View style={styles.previewItem}>
                  <Ionicons name="ticket-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.previewLabel}>Entry</Text>
                  <Text style={styles.previewValue}>{stats?.venue?.entry_fee || 'Not set'}</Text>
                </View>
                <View style={styles.previewItem}>
                  <Ionicons name="musical-notes" size={16} color={colors.textMuted} />
                  <Text style={styles.previewLabel}>Music</Text>
                  <Text style={styles.previewValue}>{stats?.venue?.music_genre || 'Not set'}</Text>
                </View>
                <View style={styles.previewItem}>
                  <Ionicons
                    name={stats?.venue?.tables_available ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={stats?.venue?.tables_available ? '#4CAF50' : '#FF5252'}
                  />
                  <Text style={styles.previewLabel}>Tables</Text>
                  <Text style={[
                    styles.previewValue,
                    { color: stats?.venue?.tables_available ? '#4CAF50' : '#FF5252' }
                  ]}>
                    {stats?.venue?.tables_available ? 'Available' : 'Full'}
                  </Text>
                </View>
                <View style={styles.previewItem}>
                  <Ionicons name="locate-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.previewLabel}>Geofence</Text>
                  <Text style={styles.previewValue}>{stats?.venue?.geofence_radius_m || 100}m</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ====== PULSE DROP - ATTRACT MORE SCOUTS ====== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 Attract More Scouts</Text>
          <Text style={styles.sectionSubtitle}>Boost visibility • Scouts earn 2x Clout at your venue</Text>
          
          {/* Active Pulse Drop Status */}
          {pulseStatus?.is_active && (
            <View style={styles.activePulseCard}>
              <LinearGradient
                colors={['#FFD70030', '#FFD70010']}
                style={styles.activePulseGradient}
              >
                <View style={styles.activePulseHeader}>
                  <Ionicons name="flash" size={24} color="#FFD700" />
                  <Text style={styles.activePulseTitle}>PULSE ACTIVE</Text>
                  <View style={styles.activePulseTier}>
                    <Text style={styles.activePulseTierText}>
                      {pulseStatus.current_tier?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                {/* Countdown Timer */}
                <View style={styles.countdownContainer}>
                  <Text style={styles.countdownLabel}>Time Remaining</Text>
                  <Text style={styles.countdownValue}>{countdown || 'Calculating...'}</Text>
                </View>
                
                <View style={styles.pulsePerks}>
                  <View style={styles.perkItem}>
                    <Ionicons name="trending-up" size={16} color="#4CAF50" />
                    <Text style={styles.perkText}>Higher visibility</Text>
                  </View>
                  <View style={styles.perkItem}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.perkText}>Gold marker on map</Text>
                  </View>
                  <View style={styles.perkItem}>
                    <Ionicons name="flash" size={16} color="#FF3366" />
                    <Text style={styles.perkText}>2x Clout for scouts</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}
          
          {/* Pulse Drop Tiers */}
          {!pulseStatus?.is_active && (
            <View style={styles.pulseTiers}>
              {Object.entries(pulseStatus?.available_tiers || {}).map(([tier, config]) => (
                <TouchableOpacity
                  key={tier}
                  style={[
                    styles.tierCard,
                    selectedTier === tier && styles.tierCardSelected
                  ]}
                  onPress={() => setSelectedTier(selectedTier === tier ? null : tier)}
                >
                  <Text style={styles.tierName}>{tier.toUpperCase()}</Text>
                  <Text style={styles.tierDuration}>{config.duration_hours}h visibility</Text>
                  <Text style={styles.tierPrice}>₦{config.price.toLocaleString()}</Text>
                  {selectedTier === tier && (
                    <TouchableOpacity
                      style={styles.activateButton}
                      onPress={() => handleActivatePulse(tier)}
                      disabled={isActivatingPulse}
                    >
                      {isActivatingPulse ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.activateButtonText}>Activate</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ====== ENERGY CAMPAIGNS ====== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Energy Campaigns</Text>
          <Text style={styles.sectionSubtitle}>Scouts earn bonus Clout at your venue</Text>

          {activeCampaign ? (
            <View style={[styles.scoreCard, { borderColor: '#FFD70050' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <Ionicons name="flash" size={24} color="#FFD700" />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFD700', flex: 1 }}>
                  {activeCampaign.multiplier}x CLOUT ACTIVE
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Scouts earn {activeCampaign.multiplier}x Clout when they rate your venue. Campaign ends {new Date(activeCampaign.expires_at).toLocaleTimeString()}.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.scoreCard, { alignItems: 'center', paddingVertical: 24 }]}
              onPress={() => isDemoMode ? Alert.alert('Demo Mode', 'Campaign creation simulated in demo mode.') : setShowCampaignModal(true)}
            >
              <Ionicons name="flash-outline" size={32} color={colors.accent} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 8 }}>
                Launch Energy Campaign
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}>
                Attract more scouts with Clout multipliers
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ====== VIBE INTELLIGENCE ====== */}
        {user?.merchant_venue_id && (
          <View style={styles.section}>
            <VibeIntelCard venueId={user.merchant_venue_id} getAuthHeaders={getAuthHeaders} />
          </View>
        )}

        {/* ====== VIBE FORECAST ====== */}
        {user?.merchant_venue_id && (
          <View style={styles.section}>
            <VibeForecast venueId={user.merchant_venue_id} />
          </View>
        )}

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark" size={16} color={colors.textMuted} />
          <Text style={styles.privacyText}>
            Your data is private. Only you can see your venue's analytics.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Campaign Creation Modal */}
      <CreateCampaignModal
        visible={showCampaignModal}
        venueId={user?.merchant_venue_id || ''}
        venueName={stats?.venue?.name || ''}
        walletBalance={stats?.wallet_balance || 0}
        getAuthHeaders={getAuthHeaders}
        onClose={() => setShowCampaignModal(false)}
        onSuccess={() => fetchAllData()}
      />

      {/* Merchant Onboarding */}
      {!hasSeenMerchantOnboarding && !loading && (
        <MerchantOnboarding visible={true} onComplete={completeMerchantOnboarding} />
      )}

      <FloorSwitcher currentFloor="merchant" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.fontSize.md,
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
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  welcomeText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  venueName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  walletBalance: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  
  // Score Card
  scoreCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  scoreLabel: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 4,
  },
  scoreMetrics: {
    flex: 1,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginLeft: spacing.sm,
    width: 50,
  },
  metricLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  deltaText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  
  // Sentiment
  sentimentGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sentimentCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sentimentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  sentimentTitle: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.semibold,
  },
  sentimentValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  sentimentSubvalue: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  sentimentBar: {
    height: 4,
    backgroundColor: colors.background,
    borderRadius: 2,
    marginTop: spacing.sm,
  },
  sentimentBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  
  // Edit Form
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.accent,
    fontWeight: typography.fontWeight.semibold,
  },
  editForm: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  switchSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  radiusOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  radiusChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    alignItems: 'center',
  },
  radiusChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  radiusChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  radiusChipTextActive: {
    color: colors.accent,
    fontWeight: typography.fontWeight.bold,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  saveButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  
  // Content Preview
  contentPreview: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  previewValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 2,
    textAlign: 'center',
  },
  
  // Pulse Drop
  activePulseCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD70050',
  },
  activePulseGradient: {
    padding: spacing.lg,
  },
  activePulseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  activePulseTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#FFD700',
    flex: 1,
  },
  activePulseTier: {
    backgroundColor: '#FFD70040',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  activePulseTierText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#FFD700',
    letterSpacing: 1,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  countdownLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  countdownValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFD700',
    marginTop: spacing.xs,
  },
  pulsePerks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  perkText: {
    fontSize: typography.fontSize.xs,
    color: colors.text,
  },
  pulseTiers: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tierCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  tierName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  tierDuration: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tierPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  activateButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  activateButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  
  // Privacy Notice
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  privacyText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
