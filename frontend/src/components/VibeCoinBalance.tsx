/**
 * VibeCoinBalance — Scout's Vibe Coins wallet card.
 * Shows balance and lets scouts spend coins on in-app perks.
 * Cashout is architecturally ready but disabled until fintech compliance.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

interface CoinBalance {
  balance: number;
  total_earned: number;
  is_vibe_plus: boolean;
}

interface Perk {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
}

interface Props {
  authToken: string;
  venueId?: string; // pass when on a venue page, enables contextual perks
}

const PERKS_STATIC: Perk[] = [
  { id: 'boost_rating', name: 'Boost Rating', description: 'Pin to venue top for 24h', cost: 50, icon: 'rocket' },
  { id: 'oracle_unlock', name: 'Oracle Unlock', description: 'AI predictions for 24h', cost: 100, icon: 'eye' },
  { id: 'planner_session', name: 'Night Planner', description: '+1 AI planning session', cost: 75, icon: 'sparkles' },
  { id: 'profile_title', name: 'Verified Scout', description: 'Permanent profile badge', cost: 200, icon: 'shield-checkmark' },
];

export default function VibeCoinBalance({ authToken, venueId }: Props) {
  const [data, setData] = useState<CoinBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShop, setShowShop] = useState(false);
  const [spending, setSpending] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/coins/balance`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData({ balance: json.balance, total_earned: json.total_earned, is_vibe_plus: json.is_vibe_plus });
      }
    } catch {}
    setLoading(false);
  }, [authToken]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const handleSpend = async (perk: Perk) => {
    const balance = data?.balance ?? 0;
    if (balance < perk.cost) {
      Alert.alert('Not enough coins', `You need ${perk.cost} coins. Keep rating venues to earn more!`);
      return;
    }
    Alert.alert(
      `Spend ${perk.cost} coins?`,
      perk.description,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Spend',
          onPress: async () => {
            setSpending(perk.id);
            try {
              const res = await fetch(`${API_URL}/api/coins/spend`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ perk: perk.id, venue_id: venueId }),
              });
              const json = await res.json();
              if (res.ok) {
                setData(prev => prev ? { ...prev, balance: json.new_balance } : null);
                Alert.alert('Done!', `${perk.name} activated.`);
              } else {
                Alert.alert('Failed', json.detail ?? 'Something went wrong');
              }
            } catch {
              Alert.alert('Error', 'Could not connect. Try again.');
            }
            setSpending(null);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="small" color="#FFD700" />
      </View>
    );
  }

  const balance = data?.balance ?? 0;
  const totalEarned = data?.total_earned ?? 0;
  const isVibePlus = data?.is_vibe_plus ?? false;

  return (
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
              <Text style={styles.vipText}>2x EARN</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => setShowShop(!showShop)}
          activeOpacity={0.8}
        >
          <Text style={styles.shopBtnText}>{showShop ? 'Close' : 'Spend'}</Text>
        </TouchableOpacity>
      </View>

      {/* Balance */}
      <Text style={styles.balance}>
        {balance.toLocaleString()}
        <Text style={styles.balanceUnit}> coins</Text>
      </Text>
      <Text style={styles.earned}>
        {totalEarned.toLocaleString()} earned total
      </Text>

      {/* Perk shop — expands when tapped */}
      {showShop && (
        <View style={styles.shop}>
          <Text style={styles.shopTitle}>SPEND COINS</Text>
          {PERKS_STATIC.map(perk => {
            const canAfford = balance >= perk.cost;
            const isLoading = spending === perk.id;
            return (
              <TouchableOpacity
                key={perk.id}
                style={[styles.perkRow, !canAfford && styles.perkRowDisabled]}
                onPress={() => handleSpend(perk)}
                activeOpacity={0.75}
                disabled={isLoading}
              >
                <View style={styles.perkIcon}>
                  <Ionicons
                    name={perk.icon as any}
                    size={16}
                    color={canAfford ? '#FFD700' : '#444'}
                  />
                </View>
                <View style={styles.perkInfo}>
                  <Text style={[styles.perkName, !canAfford && styles.textDim]}>
                    {perk.name}
                  </Text>
                  <Text style={styles.perkDesc}>{perk.description}</Text>
                </View>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <Text style={[styles.perkCost, !canAfford && styles.textDim]}>
                    {perk.cost}⟡
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!showShop && balance === 0 && (
        <Text style={styles.hint}>Rate at venues to start earning coins</Text>
      )}
    </LinearGradient>
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
  shopBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  shopBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D0D1A',
    letterSpacing: 0.5,
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
  earned: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: '#555',
    marginTop: 6,
    fontStyle: 'italic',
  },
  shop: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFD70020',
    paddingTop: 12,
    gap: 8,
  },
  shopTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFD70088',
    letterSpacing: 2,
    marginBottom: 4,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  perkRowDisabled: {
    opacity: 0.4,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFD70015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perkInfo: {
    flex: 1,
  },
  perkName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  perkDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  perkCost: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFD700',
  },
  textDim: {
    color: '#555',
  },
});
