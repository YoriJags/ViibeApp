/**
 * MissedPeaksBanner — "You Missed It" anti-FOMO card.
 * Appears on home feed when a venue you follow hit peak while you weren't there.
 * Fetches from GET /api/notifications/missed-peaks (auth required).
 * Demo: shows a static example.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface MissedPeak {
  venue_id: string;
  venue_name: string;
  area: string;
  peak_score: number;
  message: string;
}

const DEMO_MISSED: MissedPeak[] = [
  { venue_id: '1', venue_name: 'DNA Nightclub', area: 'Victoria Island', peak_score: 94, message: 'Hit 94% while you were away' },
  { venue_id: '2', venue_name: 'Club Quilox', area: 'Lekki', peak_score: 81, message: 'Hit 81% while you were away' },
];

interface Props {
  authToken?: string;
  isDemoMode?: boolean;
  onVenuePress?: (venueId: string) => void;
}

export default function MissedPeaksBanner({ authToken, isDemoMode, onVenuePress }: Props) {
  const [missed, setMissed] = useState<MissedPeak[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setMissed(DEMO_MISSED);
      return;
    }
    if (!authToken) return;
    fetch(`${API_URL}/api/notifications/missed-peaks`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(d => { if (d.missed?.length) setMissed(d.missed); })
      .catch(() => {});
  }, [authToken, isDemoMode]);

  if (dismissed || missed.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Ionicons name="time-outline" size={13} color="#FF9933" />
          <Text style={styles.label}>YOU MISSED IT</Text>
        </View>
        <TouchableOpacity onPress={() => setDismissed(true)} style={styles.closeBtn}>
          <Ionicons name="close" size={15} color="#555" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {missed.map(item => (
          <TouchableOpacity
            key={item.venue_id}
            style={styles.missedCard}
            onPress={() => onVenuePress?.(item.venue_id)}
            activeOpacity={0.8}
          >
            <View style={styles.scoreRow}>
              <Text style={styles.peak}>{item.peak_score}%</Text>
              <Ionicons name="arrow-up-circle" size={16} color="#FF9933" />
            </View>
            <Text style={styles.venueName} numberOfLines={1}>{item.venue_name}</Text>
            <Text style={styles.area} numberOfLines={1}>{item.area}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(255, 153, 51, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 51, 0.18)',
    paddingTop: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF9933',
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 2,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  missedCard: {
    width: 130,
    backgroundColor: 'rgba(255, 153, 51, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 51, 0.2)',
    padding: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  peak: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FF9933',
  },
  venueName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 1,
  },
  area: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  message: {
    fontSize: 10,
    color: '#666',
    lineHeight: 13,
    fontStyle: 'italic',
  },
});
