/**
 * NoDulling — One-tap pulse drop bar.
 * Shows when user is near a venue (isNearby=true).
 * Tap to drop a pulse on that venue — adds to its 24h rating count.
 * "No dulling" = Nigerian slang for "don't slack / don't hold back".
 *
 * This is a lightweight quick-action strip, NOT the full rating modal.
 * Pressing it fires a lightweight +1 pulse call and shows a celebration flash.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { rollVariableReward, RewardType } from './VariableRewardOverlay';

interface Props {
  venueName: string;
  venueId: string;
  // The venue's ENERGY state. This badge sits beside the venue name, so it has
  // to be the thing a person would assume it is. It used to be fed from the
  // 24h rating count, which meant "ELECTRIC" could mean "sixty ratings".
  energyLevel: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
  onDrop: (venueId: string) => Promise<void>; // caller fires the API call
  onFullRate?: () => void;                     // open the full RateVibeModal
  onVariableReward?: (type: RewardType) => void; // parent fires animation
  disabled?: boolean;                          // already dropped a pulse this session
}

// The canonical energy ladder from docs/ENERGY.md, thermal as energy always is.
const ENERGY_COLORS: Record<string, string> = {
  peak:    '#FF3366',
  lit:     '#FF6B35',
  charged: '#FFD700',
  warming: '#9933FF',
  chill:   '#3399FF',
  quiet:   '#555',
};

const ENERGY_LABELS: Record<string, string> = {
  peak:    'PEAK',
  lit:     'LIT',
  charged: 'CHARGED',
  warming: 'WARMING',
  chill:   'CHILL',
  quiet:   'QUIET',
};

export default function NoDulling({ venueName, venueId, energyLevel, onDrop, onFullRate, onVariableReward, disabled }: Props) {
  const [dropped, setDropped] = useState(false);
  const [loading, setLoading] = useState(false);

  // Flash animation on successful drop
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const tierColor = ENERGY_COLORS[energyLevel] ?? '#9933FF';
  const tierLabel = ENERGY_LABELS[energyLevel] ?? 'WARMING';

  const handleDrop = async () => {
    if (dropped || loading || disabled) return;
    setLoading(true);

    // Scale feedback
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }),
    ]).start();

    try {
      await onDrop(venueId);
      setDropped(true);

      // Roll variable reward — fire callback if something hit
      const reward = rollVariableReward();
      if (reward && onVariableReward) onVariableReward(reward);

      // Flash celebration
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.18, duration: 120, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    } catch {
      // Fail silently — pulse drop is best-effort
    } finally {
      setLoading(false);
    }
  };

  const isActionable = !dropped && !disabled && !loading;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={['#111118', '#0E0E16']}
        style={styles.container}
      >
        {/* Flash overlay on drop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.flashOverlay,
            { backgroundColor: tierColor, opacity: flashOpacity, borderRadius: 14 },
          ]}
          pointerEvents="none"
        />

        {/* Location pin */}
        <View style={styles.locationRow}>
          <Ionicons name="location" size={11} color={tierColor} />
          <Text style={[styles.nearbyText, { color: tierColor }]}>YOU'RE NEARBY</Text>
          <View style={[styles.tierPill, { borderColor: tierColor + '40' }]}>
            <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
            <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
        </View>

        <View style={styles.mainRow}>
          {/* Venue label */}
          <View style={styles.venueWrap}>
            <Text style={styles.venueName} numberOfLines={1}>{venueName}</Text>
            <Text style={styles.cta}>
              {dropped ? 'Pulse dropped! 🔥' : 'Drop a pulse — no dulling'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Quick pulse drop */}
            <TouchableOpacity
              style={[styles.dropBtn, !isActionable && styles.dropBtnDone]}
              onPress={handleDrop}
              disabled={!isActionable}
              activeOpacity={0.7}
            >
              {isActionable ? (
                <LinearGradient
                  colors={[tierColor, tierColor + 'CC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dropBtnGradient}
                >
                  <Ionicons name="flash" size={14} color="#FFF" />
                  <Text style={styles.dropBtnText}>PULSE</Text>
                </LinearGradient>
              ) : (
                <View style={styles.dropBtnGradient}>
                  <Ionicons name="checkmark" size={14} color="#4CAF50" />
                  <Text style={[styles.dropBtnText, { color: '#4CAF50' }]}>DONE</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Full rate — secondary */}
            {onFullRate && (
              <TouchableOpacity
                style={styles.rateBtn}
                onPress={onFullRate}
                activeOpacity={0.7}
              >
                <Ionicons name="star-outline" size={14} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#252530',
  },
  container: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  flashOverlay: {
    zIndex: 0,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  nearbyText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  tierDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tierText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  venueWrap: {
    flex: 1,
  },
  venueName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  cta: {
    fontSize: 11,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  dropBtnDone: {
    backgroundColor: '#1A1A28',
    borderRadius: 10,
  },
  dropBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dropBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.8,
  },
  rateBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1A1A28',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#252530',
  },
});
