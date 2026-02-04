/**
 * PulseDropSelector Component
 * 
 * A standalone component for selecting and purchasing Pulse Drop tiers.
 * Used in the Merchant Dashboard for the "Beat the Block" one-tap checkout.
 * 
 * @example
 * <PulseDropSelector
 *   venueId="venue-123"
 *   walletBalance={25000}
 *   onPurchaseSuccess={(drop) => console.log('Purchased:', drop)}
 *   onPurchaseError={(error) => console.log('Error:', error)}
 * />
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';

interface PulseDropTier {
  name: string;
  price: number;
  radius_km: number;
  glow_boost: number;
  chart_placement: number | null;
  duration_hours: number;
  description: string;
  custom_icon?: boolean;
}

interface PulseDropSelectorProps {
  venueId: string;
  walletBalance: number;
  onPurchaseSuccess?: (drop: any) => void;
  onPurchaseError?: (error: string) => void;
  onTopUpNeeded?: () => void;
}

const TIERS: Record<string, PulseDropTier> = {
  spark: {
    name: 'Spark',
    price: 5000,
    radius_km: 2,
    glow_boost: 20,
    chart_placement: null,
    duration_hours: 2,
    description: '2km radius + 20% glow',
  },
  flare: {
    name: 'Flare',
    price: 15000,
    radius_km: 5,
    glow_boost: 40,
    chart_placement: 3,
    duration_hours: 4,
    description: '5km radius + Top 3 chart',
  },
  supernova: {
    name: 'Supernova',
    price: 50000,
    radius_km: 50,
    glow_boost: 100,
    chart_placement: 1,
    duration_hours: 8,
    description: 'City-wide + #1 Trending',
    custom_icon: true,
  },
};

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const PulseDropSelector: React.FC<PulseDropSelectorProps> = ({
  venueId,
  walletBalance,
  onPurchaseSuccess,
  onPurchaseError,
  onTopUpNeeded,
}) => {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState('');

  const handlePurchase = async () => {
    if (!selectedTier) {
      Alert.alert('Select Tier', 'Please select a Pulse Drop tier');
      return;
    }

    const tier = TIERS[selectedTier];
    if (walletBalance < tier.price) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₦${(tier.price - walletBalance).toLocaleString()} more. Top up your wallet?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top Up', onPress: onTopUpNeeded },
        ]
      );
      return;
    }

    if (!message.trim()) {
      Alert.alert('Add Message', 'Please add a message for your Pulse Drop');
      return;
    }

    setPurchasing(true);
    try {
      const response = await fetch(`${API_URL}/api/pulse-drops/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          tier: selectedTier,
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Purchase failed');
      }

      onPurchaseSuccess?.(data);
      setSelectedTier(null);
      setMessage('');
      Alert.alert(
        'Pulse Drop Active!',
        `Your ${tier.name} is now live for ${tier.duration_hours} hours!`
      );
    } catch (error: any) {
      onPurchaseError?.(error.message);
      Alert.alert('Error', error.message);
    } finally {
      setPurchasing(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'spark': return colors.pulseTier.spark;
      case 'flare': return colors.pulseTier.flare;
      case 'supernova': return colors.pulseTier.supernova;
      default: return colors.text.muted;
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'spark': return 'flash';
      case 'flare': return 'flame';
      case 'supernova': return 'star';
      default: return 'flash';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="rocket" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>Trigger Pulse Drop</Text>
      </View>

      {/* Tier Selection */}
      <View style={styles.tiersContainer}>
        {Object.entries(TIERS).map(([key, tier]) => {
          const isSelected = selectedTier === key;
          const canAfford = walletBalance >= tier.price;
          const tierColor = getTierColor(key);

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tierCard,
                isSelected && { borderColor: tierColor, backgroundColor: tierColor + '20' },
                !canAfford && styles.tierCardDisabled,
              ]}
              onPress={() => setSelectedTier(key)}
              disabled={!canAfford}
            >
              <View style={[styles.tierIcon, { backgroundColor: tierColor + '20' }]}>
                <Ionicons name={getTierIcon(key) as any} size={24} color={tierColor} />
              </View>
              <Text style={[styles.tierName, isSelected && { color: tierColor }]}>
                {tier.name}
              </Text>
              <Text style={styles.tierPrice}>₦{tier.price.toLocaleString()}</Text>
              <Text style={styles.tierDescription}>{tier.description}</Text>
              <Text style={styles.tierDuration}>{tier.duration_hours}h</Text>
              {!canAfford && (
                <View style={styles.insufficientBadge}>
                  <Text style={styles.insufficientText}>Top up needed</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Message Input */}
      {selectedTier && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Drop Message</Text>
          <View style={styles.messageInput}>
            <Ionicons name="chatbubble" size={20} color={colors.text.muted} />
            <Text
              style={styles.messageText}
              numberOfLines={2}
            >
              {message || 'E.g., "Happy Hour 50% Off!"'}
            </Text>
          </View>
        </View>
      )}

      {/* Purchase Button */}
      <TouchableOpacity
        style={[
          styles.purchaseButton,
          (!selectedTier || purchasing) && styles.purchaseButtonDisabled,
        ]}
        onPress={handlePurchase}
        disabled={!selectedTier || purchasing}
      >
        {purchasing ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="flash" size={24} color="#FFF" />
            <Text style={styles.purchaseButtonText}>
              {selectedTier
                ? `Drop ${TIERS[selectedTier].name} - ₦${TIERS[selectedTier].price.toLocaleString()}`
                : 'Select a Tier'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Wallet Balance */}
      <View style={styles.walletInfo}>
        <Ionicons name="wallet" size={16} color={colors.text.muted} />
        <Text style={styles.walletText}>
          Wallet: ₦{walletBalance.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  tiersContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tierCard: {
    flex: 1,
    backgroundColor: colors.background.dark,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierCardDisabled: {
    opacity: 0.5,
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tierName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  tierPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  tierDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  tierDuration: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  insufficientBadge: {
    backgroundColor: colors.status.error + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  insufficientText: {
    fontSize: typography.fontSize.xs,
    color: colors.status.error,
  },
  messageContainer: {
    marginBottom: spacing.lg,
  },
  messageLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  messageInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.dark,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  messageText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  purchaseButtonDisabled: {
    backgroundColor: colors.text.disabled,
  },
  purchaseButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  walletText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
});

export default PulseDropSelector;
