/**
 * RewardPoolBadge — Small indicator shown on venue cards/headers when
 * the venue has an active scout reward pool.
 * Tells scouts they'll earn cashable coins for rating this venue.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  coinRate: number;   // coins per rating from pool
  compact?: boolean;  // smaller pill variant for venue cards
}

export default function RewardPoolBadge({ coinRate, compact = false }: Props) {
  if (!coinRate || coinRate <= 0) return null;

  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Text style={[styles.text, compact && styles.textCompact]}>
        ⟡ +{coinRate} coins/rating
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFD70018',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFD70050',
    alignSelf: 'flex-start',
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  textCompact: {
    fontSize: 9,
  },
});
