/**
 * MERCHANT FLOOR - Wallet
 * Fintech-style wallet management
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
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = merchantTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const POOL_TIERS = [
  { label: '₦10,000', amount: 10000, coins: 2000, bonus: '' },
  { label: '₦25,000', amount: 25000, coins: 5500, bonus: '+10% bonus' },
  { label: '₦50,000', amount: 50000, coins: 11000, bonus: '+10% bonus' },
];

export default function MerchantWallet() {
  const { user, getAuthHeaders } = useVibeStore();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePool, setActivePool] = useState<{ active: boolean; coins_remaining?: number; coin_rate?: number; expires_at?: string } | null>(null);
  const [fundingTier, setFundingTier] = useState<typeof POOL_TIERS[0] | null>(null);
  const [fundingPool, setFundingPool] = useState(false);

  const fetchBalance = async () => {
    if (!user?.merchant_venue_id) return;
    try {
      const [statsRes, poolRes] = await Promise.all([
        fetch(`${API_URL}/api/merchant/venue/${user.merchant_venue_id}/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/venues/${user.merchant_venue_id}/reward-pool`, { headers: getAuthHeaders() }),
      ]);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setBalance(data.venue?.wallet_balance || 0);
      }
      if (poolRes.ok) setActivePool(await poolRes.json());
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fundPool = async (tier: typeof POOL_TIERS[0]) => {
    if (!user?.merchant_venue_id) return;
    if (balance < tier.amount) {
      Alert.alert('Insufficient Balance', `You need ₦${tier.amount.toLocaleString()} in your wallet to fund this pool.`);
      return;
    }
    Alert.alert(
      'Fund Scout Reward Pool',
      `Deduct ₦${tier.amount.toLocaleString()} from your wallet to fund ${tier.coins.toLocaleString()} coins for scouts? Pool lasts 7 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fund Pool',
          onPress: async () => {
            setFundingPool(true);
            setFundingTier(tier);
            try {
              const res = await fetch(`${API_URL}/api/venues/${user.merchant_venue_id}/reward-pool/fund`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ amount_naira: tier.amount }),
              });
              const d = await res.json();
              if (d.ok) {
                Alert.alert('Pool Funded!', `${d.coins_funded.toLocaleString()} coins are now available for scouts who rate your venue.`);
                fetchBalance();
              } else {
                Alert.alert('Error', d.detail ?? 'Could not fund pool.');
              }
            } catch {
              Alert.alert('Error', 'Network error. Try again.');
            }
            setFundingPool(false);
            setFundingTier(null);
          },
        },
      ]
    );
  };

  useEffect(() => {
    fetchBalance();
  }, [user?.merchant_venue_id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalance();
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.balanceAmount}>₦{balance.toLocaleString()}</Text>
          )}
          <TouchableOpacity
            style={styles.topUpButton}
            onPress={() => Alert.alert(
              'Top Up Wallet',
              'To top up your wallet, contact support or use your Paystack dashboard. Automated top-up coming soon.',
              [{ text: 'OK' }]
            )}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.topUpText}>Top Up Wallet</Text>
          </TouchableOpacity>
        </View>

        {/* Spending Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pulse Drop Pricing</Text>
          <View style={styles.tiersList}>
            <View style={styles.tierCard}>
              <View style={[styles.tierIcon, { backgroundColor: '#FFD70020' }]}>
                <Ionicons name="flash" size={24} color="#FFD700" />
              </View>
              <View style={styles.tierInfo}>
                <Text style={styles.tierName}>Spark</Text>
                <Text style={styles.tierDesc}>15-min visibility boost</Text>
              </View>
              <Text style={styles.tierPrice}>₦5,000</Text>
            </View>
            <View style={styles.tierCard}>
              <View style={[styles.tierIcon, { backgroundColor: '#FF630020' }]}>
                <Ionicons name="flame" size={24} color="#FF6300" />
              </View>
              <View style={styles.tierInfo}>
                <Text style={styles.tierName}>Flare</Text>
                <Text style={styles.tierDesc}>1-hour visibility boost</Text>
              </View>
              <Text style={styles.tierPrice}>₦15,000</Text>
            </View>
            <View style={styles.tierCard}>
              <View style={[styles.tierIcon, { backgroundColor: '#FF336620' }]}>
                <Ionicons name="rocket" size={24} color="#FF3366" />
              </View>
              <View style={styles.tierInfo}>
                <Text style={styles.tierName}>Supernova</Text>
                <Text style={styles.tierDesc}>4-hour priority placement</Text>
              </View>
              <Text style={styles.tierPrice}>₦50,000</Text>
            </View>
          </View>
        </View>

        {/* Scout Reward Pool */}
        <View style={[styles.section, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Scout Reward Pool</Text>
          <Text style={styles.poolDesc}>
            Pay scouts to visit and rate your venue. Every coin is backed by your wallet — scouts earn real cashable coins, you get real ratings.
          </Text>

          {activePool?.active && (
            <View style={styles.activePoolCard}>
              <Text style={styles.activePoolLabel}>ACTIVE POOL</Text>
              <Text style={styles.activePoolCoins}>{activePool.coins_remaining?.toLocaleString()} coins remaining</Text>
              <Text style={styles.activePoolRate}>⟡ +{activePool.coin_rate} coins per rating</Text>
              <Text style={styles.activePoolExpiry}>
                Expires {activePool.expires_at ? new Date(activePool.expires_at).toLocaleDateString() : '—'}
              </Text>
            </View>
          )}

          <View style={styles.tiersList}>
            {POOL_TIERS.map(tier => (
              <TouchableOpacity
                key={tier.amount}
                style={styles.poolTierCard}
                onPress={() => fundPool(tier)}
                disabled={fundingPool}
                activeOpacity={0.8}
              >
                <View style={styles.tierInfo}>
                  <Text style={styles.tierName}>{tier.label}</Text>
                  <Text style={styles.tierDesc}>
                    {tier.coins.toLocaleString()} coins for scouts
                    {tier.bonus ? `  ·  ${tier.bonus}` : ''}
                  </Text>
                </View>
                {fundingPool && fundingTier?.amount === tier.amount
                  ? <ActivityIndicator size="small" color="#FFD700" />
                  : <Text style={styles.fundBtn}>Fund →</Text>
                }
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.poolNote}>
            T&Cs: Pools expire in 7 days. Unused coins are non-refundable. Platform retains a spread on coin conversion.
          </Text>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  balanceCard: {
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  balanceAmount: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.black,
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  topUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  topUpText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  section: {
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  tiersList: {
    gap: spacing.md,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  tierName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  tierDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  tierPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  poolDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  activePoolCard: {
    backgroundColor: '#FFD70012',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FFD70040',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  activePoolLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  activePoolCoins: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#FFD700',
  },
  activePoolRate: {
    fontSize: typography.fontSize.sm,
    color: '#FFD70099',
    marginTop: 2,
  },
  activePoolExpiry: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 4,
  },
  poolTierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#FFD70020',
  },
  fundBtn: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFD700',
  },
  poolNote: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: spacing.md,
    lineHeight: 16,
  },
});
