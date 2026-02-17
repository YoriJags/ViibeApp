/**
 * CreateCampaignModal - Merchant creates an energy campaign
 * Select multiplier, duration, see pricing, confirm & pay
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = merchantTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface CreateCampaignModalProps {
  visible: boolean;
  venueId: string;
  venueName: string;
  walletBalance: number;
  getAuthHeaders: () => Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}

const PRICING: Record<string, number> = {
  '2_2': 3000,
  '2_4': 5000,
  '2_8': 8000,
  '3_2': 7000,
  '3_4': 12000,
  '3_8': 20000,
};

export default function CreateCampaignModal({
  visible,
  venueId,
  venueName,
  walletBalance,
  getAuthHeaders,
  onClose,
  onSuccess,
}: CreateCampaignModalProps) {
  const [multiplier, setMultiplier] = useState<2 | 3>(2);
  const [duration, setDuration] = useState<2 | 4 | 8>(2);
  const [loading, setLoading] = useState(false);

  const priceKey = `${multiplier}_${duration}`;
  const price = PRICING[priceKey] || 0;
  const canAfford = walletBalance >= price;

  const handleCreate = async () => {
    if (!canAfford) {
      Alert.alert('Insufficient Balance', `You need ₦${price.toLocaleString()} but have ₦${walletBalance.toLocaleString()}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/merchant/venue/${venueId}/campaigns`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ multiplier, duration_hours: duration }),
        }
      );

      if (res.ok) {
        Alert.alert(
          'Campaign Launched!',
          `${multiplier}x Clout is now active at ${venueName} for ${duration} hours. Scouts are being notified!`
        );
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to create campaign');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to launch campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Launch Energy Campaign</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Scouts earn extra Clout at {venueName}. More energy, more traffic.
          </Text>

          {/* Multiplier Selection */}
          <Text style={styles.label}>Clout Multiplier</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.option, multiplier === 2 && styles.optionActive]}
              onPress={() => setMultiplier(2)}
            >
              <Ionicons name="flash" size={20} color={multiplier === 2 ? '#FFD700' : '#666'} />
              <Text style={[styles.optionText, multiplier === 2 && styles.optionTextActive]}>2x</Text>
              <Text style={styles.optionDesc}>Double Clout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, multiplier === 3 && styles.optionActive]}
              onPress={() => setMultiplier(3)}
            >
              <Ionicons name="flash" size={20} color={multiplier === 3 ? '#FF3366' : '#666'} />
              <Text style={[styles.optionText, multiplier === 3 && styles.optionTextActive]}>3x</Text>
              <Text style={styles.optionDesc}>Triple Clout</Text>
            </TouchableOpacity>
          </View>

          {/* Duration Selection */}
          <Text style={styles.label}>Duration</Text>
          <View style={styles.optionRow}>
            {([2, 4, 8] as const).map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.option, styles.durationOption, duration === d && styles.optionActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[styles.optionText, duration === d && styles.optionTextActive]}>{d}h</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Price Summary */}
          <View style={styles.priceSummary}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Campaign Cost</Text>
              <Text style={styles.priceValue}>₦{price.toLocaleString()}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Wallet Balance</Text>
              <Text style={[styles.priceValue, { color: canAfford ? '#4CAF50' : '#FF5252' }]}>
                ₦{walletBalance.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Launch Button */}
          <TouchableOpacity
            style={[styles.launchButton, !canAfford && styles.launchButtonDisabled]}
            onPress={handleCreate}
            disabled={loading || !canAfford}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#000" />
                <Text style={styles.launchText}>
                  {canAfford ? 'Launch Campaign' : 'Insufficient Balance'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {!canAfford && (
            <Text style={styles.topUpHint}>Top up your wallet to launch this campaign</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginBottom: 24,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionActive: {
    borderColor: colors.gold + '60',
    backgroundColor: colors.gold + '10',
  },
  durationOption: {
    paddingVertical: 12,
  },
  optionText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
    marginTop: 4,
  },
  optionTextActive: {
    color: colors.gold,
  },
  optionDesc: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 2,
  },
  priceSummary: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  priceValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  launchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    gap: 8,
  },
  launchButtonDisabled: {
    backgroundColor: '#333',
  },
  launchText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#000',
  },
  topUpHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 10,
  },
});
