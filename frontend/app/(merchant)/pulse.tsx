/**
 * MERCHANT FLOOR - Pulse Drop Checkout
 * Self-service: wallet balance → tier selection → confirm → activate
 * Prices are live from /api/merchant/venue/{id}/pulse-status (economy config)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const { colors } = merchantTheme;

interface TierConfig {
  name: string;
  price: number;
  duration_hours: number;
  radius_km: number;
  glow_boost: number;
  chart_placement: number | null;
  description: string;
}

interface PulseStatus {
  active: boolean;
  tier?: string;
  expires_at?: string;
  tiers: Record<string, TierConfig>;
  wallet_balance: number;
}

const TIER_ICONS: Record<string, string> = {
  spark: 'flash',
  flare: 'flame',
  supernova: 'rocket',
};

const TIER_COLORS: Record<string, string> = {
  spark: '#FFD700',
  flare: '#FF6300',
  supernova: '#FF3366',
};

const TIER_BG: Record<string, string> = {
  spark: '#FFD70020',
  flare: '#FF630020',
  supernova: '#FF336620',
};

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '0:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function MerchantPulse() {
  const { user, getAuthHeaders } = useVibeStore();
  const token = (getAuthHeaders() as any)?.Authorization?.replace('Bearer ', '');
  const venueId = user?.merchant_venue_id;

  const [status, setStatus] = useState<PulseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!venueId) return;
    try {
      const res = await fetch(`${API_URL}/merchant/venue/${venueId}/pulse-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      // network error — keep stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId, token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Live countdown ticker
  useEffect(() => {
    if (status?.active && status.expires_at) {
      const tick = () => setCountdown(formatCountdown(status.expires_at!));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status?.active, status?.expires_at]);

  const handleActivate = async () => {
    if (!selectedTier || !venueId) return;
    setActivating(true);
    try {
      const res = await fetch(
        `${API_URL}/merchant/venue/${venueId}/pulse-drop?tier=${selectedTier}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSelectedTier(null);
        await fetchStatus();
        Alert.alert(
          '⚡ Pulse Drop Active!',
          `${data.tier_name || selectedTier} is live for ${data.duration_hours}h.\nYour venue is now boosted across ${data.radius_km}km.`
        );
      } else {
        Alert.alert('Could not activate', data.detail || 'Please try again.');
      }
    } catch {
      Alert.alert('Network error', 'Check your connection and try again.');
    } finally {
      setActivating(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const tiers = status?.tiers ?? {};
  const tierKeys = ['spark', 'flare', 'supernova'].filter((k) => tiers[k]);
  const selectedConfig = selectedTier ? tiers[selectedTier] : null;
  const walletBalance = status?.wallet_balance ?? 0;
  const balanceAfter = selectedConfig ? walletBalance - selectedConfig.price : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pulse Drops</Text>
          <Text style={styles.headerSubtitle}>Amplify your venue — scouts see you first</Text>
        </View>

        {/* Wallet balance */}
        <View style={styles.walletCard}>
          <Ionicons name="wallet-outline" size={20} color={colors.primary} />
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletAmount}>₦{walletBalance.toLocaleString()}</Text>
        </View>

        {/* Active pulse banner */}
        {status?.active && status.expires_at && (
          <View style={styles.activeBanner}>
            <Ionicons name="radio" size={18} color="#00E676" />
            <Text style={styles.activeBannerText}>
              {status.tier ? `${status.tier.charAt(0).toUpperCase() + status.tier.slice(1)} LIVE` : 'PULSE ACTIVE'} — {countdown} remaining
            </Text>
          </View>
        )}

        {/* Tier cards */}
        <Text style={styles.sectionLabel}>SELECT TIER</Text>
        {tierKeys.map((key) => {
          const tier = tiers[key];
          const canAfford = walletBalance >= tier.price;
          const isActive = status?.active && status.tier === key;

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tierCard,
                !canAfford && styles.tierCardLocked,
                isActive && styles.tierCardActive,
              ]}
              onPress={() => canAfford && !status?.active && setSelectedTier(key)}
              activeOpacity={canAfford && !status?.active ? 0.7 : 1}
            >
              <View style={[styles.tierIcon, { backgroundColor: TIER_BG[key] }]}>
                <Ionicons
                  name={TIER_ICONS[key] as any}
                  size={30}
                  color={canAfford ? TIER_COLORS[key] : colors.text.muted}
                />
              </View>

              <View style={styles.tierInfo}>
                <View style={styles.tierNameRow}>
                  <Text style={[styles.tierName, !canAfford && styles.mutedText]}>
                    {tier.name}
                  </Text>
                  {isActive && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  )}
                  {!canAfford && (
                    <Ionicons name="lock-closed" size={14} color={colors.text.muted} />
                  )}
                </View>
                <Text style={[styles.tierDesc, !canAfford && styles.mutedText]}>
                  {tier.duration_hours}h · {tier.radius_km}km radius · +{tier.glow_boost}% glow
                  {tier.chart_placement ? ` · Top ${tier.chart_placement} chart` : ''}
                </Text>
                <Text style={[styles.tierPrice, !canAfford && styles.mutedText]}>
                  ₦{tier.price.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {status?.active && (
          <Text style={styles.activeNote}>
            A pulse is already running. It will complete before you can activate another.
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirm bottom sheet */}
      <Modal
        visible={!!selectedTier && !!selectedConfig}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTier(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => !activating && setSelectedTier(null)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Confirm Pulse Drop</Text>

          {selectedConfig && (
            <>
              <View style={styles.sheetRow}>
                <Ionicons name={TIER_ICONS[selectedTier!] as any} size={18} color={TIER_COLORS[selectedTier!]} />
                <Text style={styles.sheetTierName}>{selectedConfig.name}</Text>
              </View>

              <View style={styles.sheetDivider} />

              <View style={styles.sheetDetailRow}>
                <Text style={styles.sheetDetailLabel}>Duration</Text>
                <Text style={styles.sheetDetailValue}>{selectedConfig.duration_hours} hours</Text>
              </View>
              <View style={styles.sheetDetailRow}>
                <Text style={styles.sheetDetailLabel}>Radius</Text>
                <Text style={styles.sheetDetailValue}>{selectedConfig.radius_km} km</Text>
              </View>
              <View style={styles.sheetDetailRow}>
                <Text style={styles.sheetDetailLabel}>Glow Boost</Text>
                <Text style={styles.sheetDetailValue}>+{selectedConfig.glow_boost}%</Text>
              </View>
              {selectedConfig.chart_placement && (
                <View style={styles.sheetDetailRow}>
                  <Text style={styles.sheetDetailLabel}>Chart</Text>
                  <Text style={styles.sheetDetailValue}>Top {selectedConfig.chart_placement} placement</Text>
                </View>
              )}

              <View style={styles.sheetDivider} />

              <View style={styles.sheetDetailRow}>
                <Text style={styles.sheetDetailLabel}>Cost</Text>
                <Text style={[styles.sheetDetailValue, { color: '#FF3366' }]}>
                  −₦{selectedConfig.price.toLocaleString()}
                </Text>
              </View>
              <View style={styles.sheetDetailRow}>
                <Text style={styles.sheetDetailLabel}>Balance after</Text>
                <Text style={[styles.sheetDetailValue, { color: balanceAfter >= 0 ? '#00E676' : '#FF3366' }]}>
                  ₦{balanceAfter.toLocaleString()}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, activating && styles.confirmBtnDisabled]}
                onPress={handleActivate}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.confirmBtnText}>⚡ Activate {selectedConfig.name}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !activating && setSelectedTier(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.dark },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingVertical: spacing.xl },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  walletLabel: { flex: 1, fontSize: typography.fontSize.md, color: colors.text.secondary },
  walletAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#00E67615',
    borderWidth: 1,
    borderColor: '#00E67640',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  activeBannerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: '#00E676',
  },

  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierCardLocked: { opacity: 0.5 },
  tierCardActive: { borderColor: '#00E676' },
  tierIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierInfo: { flex: 1, marginLeft: spacing.md },
  tierNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tierName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  tierDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: 2,
  },
  tierPrice: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  mutedText: { color: colors.text.muted },

  liveBadge: {
    backgroundColor: '#00E67620',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#00E676', letterSpacing: 0.8 },

  activeNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  // Bottom sheet modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sheetTierName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sheetDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sheetDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetDetailLabel: { fontSize: typography.fontSize.md, color: colors.text.secondary },
  sheetDetailValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#000',
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelBtnText: { fontSize: typography.fontSize.md, color: colors.text.muted },
});
