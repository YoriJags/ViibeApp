/**
 * VenueRoastCard — Claude AI personality review for a venue.
 * Shown on venue detail page. Punchy Nigerian-voice 2-sentence review.
 * Requires active Vibe+ subscription.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';
import VibePlusModal from './VibePlusModal';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Props {
  venueId: string;
  venueName: string;
  isDemoMode?: boolean;
}

const DEMO_ROASTS: Record<string, { review: string; vibe_word: string }> = {
  default: {
    review: "DNA Nightclub doesn't play — the sound system hits different and the energy is certified electric by midnight. Entry price is what it is, but the vibe you get back is worth every naira.",
    vibe_word: "Unmatched",
  },
};

export default function VenueRoastCard({ venueId, venueName, isDemoMode }: Props) {
  const { isVibePlus } = useVibeStore();
  const [data, setData] = useState<{ review: string; vibe_word?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVibePlus, setShowVibePlus] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setData(DEMO_ROASTS.default);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/venues/${venueId}/roast-toast`)
      .then(r => r.json())
      .then(d => { if (d.review) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [venueId, isDemoMode]);

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator size="small" color="#9933FF" />
    </View>
  );

  if (!data) return null;

  return (
    <>
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>AI TAKE</Text>
        <View style={styles.headerRight}>
          {data.vibe_word && <Text style={styles.vibeWord}>{data.vibe_word}</Text>}
          {!isVibePlus() && (
            <TouchableOpacity style={styles.lockChip} onPress={() => setShowVibePlus(true)}>
              <Ionicons name="lock-closed" size={10} color="#FFD700" />
              <Text style={styles.lockChipText}>VIBE+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isVibePlus() ? (
        <>
          <Text style={styles.quoteChar}>"</Text>
          <Text style={styles.review}>{data.review}</Text>
        </>
      ) : (
        <TouchableOpacity style={styles.lockedOverlay} onPress={() => setShowVibePlus(true)} activeOpacity={0.8}>
          <Text style={styles.lockedPreview} numberOfLines={1}>
            {data.review.substring(0, 42)}...
          </Text>
          <View style={styles.lockedRow}>
            <Ionicons name="lock-closed" size={13} color="#FFD700" />
            <Text style={styles.lockedText}>Unlock full AI take — Viibe+ ₦2,000/mo</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>

    <VibePlusModal
      visible={showVibePlus}
      onClose={() => setShowVibePlus(false)}
      onSuccess={() => setShowVibePlus(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 8, alignItems: 'center' },
  card: {
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: 'rgba(153,51,255,0.07)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(153,51,255,0.2)',
    gap: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: '#9933FF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  vibeWord: {
    color: '#9933FF',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(153,51,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  lockChipText: { color: '#FFD700', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  quoteChar: { color: 'rgba(153,51,255,0.3)', fontSize: 36, lineHeight: 28, fontWeight: '900' },
  review: { color: '#CCC', fontSize: 13, lineHeight: 20, marginTop: -4 },
  lockedOverlay: {
    gap: 8,
    paddingVertical: 4,
  },
  lockedPreview: {
    color: 'rgba(204,204,204,0.35)',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  lockedText: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
});
