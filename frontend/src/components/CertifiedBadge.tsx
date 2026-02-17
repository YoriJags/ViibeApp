/**
 * CertifiedBadge - Gold shield badge for Vibe Certified venues
 * 90+ days of verified high energy
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CertifiedBadgeProps {
  compact?: boolean;
  score?: number;
}

export default function CertifiedBadge({ compact = false, score }: CertifiedBadgeProps) {
  if (compact) {
    return (
      <View style={styles.compactBadge}>
        <Ionicons name="shield-checkmark" size={12} color="#FFD700" />
      </View>
    );
  }

  return (
    <View style={styles.badge}>
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark" size={18} color="#FFD700" />
      </View>
      <View>
        <Text style={styles.label}>Vibe Certified</Text>
        {score ? (
          <Text style={styles.score}>{score}% avg</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70015',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FFD70030',
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD70020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
  },
  score: {
    fontSize: 10,
    color: '#FFD700AA',
    marginTop: 1,
  },
  compactBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFD70020',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
