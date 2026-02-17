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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { merchantTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = merchantTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function MerchantWallet() {
  const router = useRouter();
  const { user, getAuthHeaders } = useVibeStore();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalance = async () => {
    if (!user?.merchant_venue_id) return;
    try {
      const response = await fetch(
        `${API_URL}/api/merchant/venue/${user.merchant_venue_id}/stats`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setBalance(data.venue?.wallet_balance || 0);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setLoading(false);
    }
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
            onPress={() => router.push(`/merchant/topup/${user?.merchant_venue_id}`)}
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
});
