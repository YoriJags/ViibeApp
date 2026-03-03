/**
 * VibeCoinBalance — Scout's Vibe Coins wallet card.
 * Shows balance, naira equivalent, and opens CoinCashoutModal.
 * Coins are earned only at participating venues (pool-funded).
 * T&C: cashback applies only at venues with active reward pools.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CoinCashoutModal from './CoinCashoutModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

interface CoinBalance {
  balance: number;
  total_earned: number;
  total_cashed_out: number;
  cashout_rate_naira: number;
  cashout_min_coins: number;
  is_vibe_plus: boolean;
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    venue_id?: string;
    timestamp: string;
  }>;
}

interface Props {
  authToken: string;
}

export default function VibeCoinBalance({ authToken }: Props) {
  const [data, setData] = useState<CoinBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCashout, setShowCashout] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/coins/balance`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [authToken]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="small" color="#FFD700" />
      </View>
    );
  }

  const balance = data?.balance ?? 0;
  const rate = data?.cashout_rate_naira ?? 40;
  const nairaValue = Math.floor((balance / 100) * rate);
  const isVibePlus = data?.is_vibe_plus ?? false;
  const minCoins = data?.cashout_min_coins ?? 500;
  const canCashout = balance >= minCoins;

  return (
    <>
      <LinearGradient
        colors={['#1A1A2E', '#16213E']}
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.labelRow}>
            <Text style={styles.coinIcon}>⟡</Text>
            <Text style={styles.label}>VIBE COINS</Text>
            {isVibePlus && (
              <View style={styles.vipBadge}>
                <Text style={styles.vipText}>VIBE+</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.cashoutBtn, !canCashout && styles.cashoutBtnDisabled]}
            onPress={() => canCashout && setShowCashout(true)}
            activeOpacity={canCashout ? 0.8 : 1}
          >
            <Text style={[styles.cashoutText, !canCashout && styles.cashoutTextDisabled]}>
              Cash Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <Text style={styles.balance}>
          {balance.toLocaleString()}
          <Text style={styles.balanceUnit}> coins</Text>
        </Text>

        {/* Naira value */}
        <Text style={styles.nairaValue}>
          ≈ ₦{nairaValue.toLocaleString()} value
          <Text style={styles.rateNote}>  ·  ₦{rate}/100 coins</Text>
        </Text>

        {/* Min cashout hint */}
        {!canCashout && balance > 0 && (
          <Text style={styles.hint}>
            {minCoins - balance} more coins until you can cash out
          </Text>
        )}
        {balance === 0 && (
          <Text style={styles.hint}>
            Rate at participating venues to earn cashable coins
          </Text>
        )}

        {/* T&C note */}
        <Text style={styles.tnc}>
          Cashback available at participating venues only · T&Cs apply
        </Text>
      </LinearGradient>

      <CoinCashoutModal
        visible={showCashout}
        onClose={() => setShowCashout(false)}
        onSuccess={() => { setShowCashout(false); fetchBalance(); }}
        authToken={authToken}
        balance={balance}
        cashoutRateNaira={rate}
        minCoins={minCoins}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingWrapper: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FFD70030',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinIcon: {
    fontSize: 14,
    color: '#FFD700',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#FFD700',
  },
  vipBadge: {
    backgroundColor: '#FFD70020',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#FFD70060',
  },
  vipText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
  },
  cashoutBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cashoutBtnDisabled: {
    backgroundColor: '#333',
  },
  cashoutText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D0D1A',
    letterSpacing: 0.5,
  },
  cashoutTextDisabled: {
    color: '#666',
  },
  balance: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  balanceUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#888',
  },
  nairaValue: {
    fontSize: 13,
    color: '#AAA',
    marginTop: 2,
  },
  rateNote: {
    fontSize: 11,
    color: '#666',
  },
  hint: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
    fontStyle: 'italic',
  },
  tnc: {
    fontSize: 9,
    color: '#444',
    marginTop: 10,
    letterSpacing: 0.3,
  },
});
