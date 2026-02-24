/**
 * VenueRoastCard — Claude AI personality review for a venue.
 * Shown on venue detail page. Punchy Nigerian-voice 2-sentence review.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

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
  const [data, setData] = useState<{ review: string; vibe_word?: string } | null>(null);
  const [loading, setLoading] = useState(true);

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
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>AI TAKE</Text>
        {data.vibe_word && <Text style={styles.vibeWord}>{data.vibe_word}</Text>}
      </View>
      <Text style={styles.quoteChar}>"</Text>
      <Text style={styles.review}>{data.review}</Text>
    </View>
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
  quoteChar: { color: 'rgba(153,51,255,0.3)', fontSize: 36, lineHeight: 28, fontWeight: '900' },
  review: { color: '#CCC', fontSize: 13, lineHeight: 20, marginTop: -4 },
});
