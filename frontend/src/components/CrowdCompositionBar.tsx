/**
 * CrowdCompositionBar — Live persona breakdown for a venue.
 * Shows who is actually there right now based on the last 4 hours of ratings.
 * Lives on the venue detail page below the energy meter.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface PersonaSlice {
  persona: string;
  label: string;
  emoji: string;
  color: string;
  count: number;
  pct: number;
}

interface CompositionData {
  available: boolean;
  sample_size: number;
  dominant_persona?: PersonaSlice;
  composition: PersonaSlice[];
  vibe_description?: string;
  message?: string;
}

const DEMO: CompositionData = {
  available: true,
  sample_size: 23,
  vibe_description: 'Turn Up meets Grown & Sexy',
  dominant_persona: { persona: 'turn_up', label: 'Turn Up', emoji: '🔥', color: '#FF3366', count: 13, pct: 57 },
  composition: [
    { persona: 'turn_up', label: 'Turn Up', emoji: '🔥', color: '#FF3366', count: 13, pct: 57 },
    { persona: 'grown_sexy', label: 'Grown & Sexy', emoji: '✨', color: '#9B59B6', count: 7, pct: 30 },
    { persona: 'culture', label: 'Culture Vulture', emoji: '🎭', color: '#3399FF', count: 3, pct: 13 },
  ],
};

interface Props {
  venueId: string;
  isDemoMode?: boolean;
}

export default function CrowdCompositionBar({ venueId, isDemoMode }: Props) {
  const [data, setData] = useState<CompositionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      setData(DEMO);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/venues/${venueId}/crowd-composition`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [venueId, isDemoMode]);

  if (loading) return <ActivityIndicator size="small" color="#888" style={{ paddingVertical: 8 }} />;
  if (!data?.available) return null;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>CROWD TONIGHT</Text>
        <Text style={styles.sample}>{data.sample_size} scouts · last 4h</Text>
      </View>

      {/* Description */}
      {data.vibe_description && (
        <Text style={styles.description}>{data.vibe_description}</Text>
      )}

      {/* Stacked bar */}
      <View style={styles.barContainer}>
        {data.composition.map(slice => (
          <View
            key={slice.persona}
            style={[
              styles.barSlice,
              {
                flex: slice.pct,
                backgroundColor: slice.color,
              },
            ]}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.composition.map(slice => (
          <View key={slice.persona} style={styles.legendItem}>
            <Text style={styles.legendEmoji}>{slice.emoji}</Text>
            <Text style={styles.legendLabel}>{slice.label}</Text>
            <Text style={[styles.legendPct, { color: slice.color }]}>{slice.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 2,
  },
  sample: {
    fontSize: 9,
    color: '#444',
  },
  description: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CCC',
    marginBottom: 10,
  },
  barContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
    gap: 2,
  },
  barSlice: {
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendEmoji: {
    fontSize: 12,
  },
  legendLabel: {
    fontSize: 10,
    color: '#888',
  },
  legendPct: {
    fontSize: 10,
    fontWeight: '800',
  },
});
