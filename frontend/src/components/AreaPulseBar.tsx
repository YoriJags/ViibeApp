/**
 * AreaPulseBar — Horizontal area heat strip.
 * Shows which area of the city is hottest right now.
 * Lives above the venue list on the home screen.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AreaData {
  area: string;
  avg_score: number;
  peak_score: number;
  venue_count: number;
  trending: 'rising' | 'cooling' | 'stable';
  state: 'electric' | 'popping' | 'warming' | 'quiet';
  top_venue: string;
}

const STATE_COLORS = {
  electric: '#FF3366',
  popping: '#FF9933',
  warming: '#9933FF',
  quiet: '#3399FF',
};

const DEMO_AREAS: AreaData[] = [
  { area: 'Victoria Island', avg_score: 78, peak_score: 94, venue_count: 4, trending: 'rising', state: 'popping', top_venue: 'DNA Nightclub' },
  { area: 'Lekki', avg_score: 62, peak_score: 81, venue_count: 3, trending: 'stable', state: 'warming', top_venue: 'Club Quilox' },
  { area: 'Ikoyi', avg_score: 44, peak_score: 60, venue_count: 2, trending: 'cooling', state: 'warming', top_venue: 'The Hard Rock' },
  { area: 'Allen/Ikeja', avg_score: 28, peak_score: 38, venue_count: 2, trending: 'stable', state: 'quiet', top_venue: 'Sky Bar' },
];

interface Props {
  city: string;
  isDemoMode?: boolean;
  onAreaPress?: (area: string) => void;
}

export default function AreaPulseBar({ city, isDemoMode, onAreaPress }: Props) {
  const [areas, setAreas] = useState<AreaData[]>([]);

  useEffect(() => {
    if (isDemoMode) {
      setAreas(DEMO_AREAS);
      return;
    }
    fetch(`${API_URL}/api/area-pulse/${city}`)
      .then(r => r.json())
      .then(d => { if (d.areas?.length) setAreas(d.areas); })
      .catch(() => {});
  }, [city, isDemoMode]);

  if (!areas.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>AREA PULSE</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {areas.map(area => {
          const color = STATE_COLORS[area.state];
          return (
            <TouchableOpacity
              key={area.area}
              style={[styles.chip, { borderColor: color + '40' }]}
              onPress={() => onAreaPress?.(area.area)}
              activeOpacity={0.8}
            >
              <View style={styles.chipTop}>
                <Text style={[styles.chipScore, { color }]}>{area.avg_score}%</Text>
                {area.trending === 'rising' && <Ionicons name="trending-up" size={11} color="#4CAF50" />}
                {area.trending === 'cooling' && <Ionicons name="trending-down" size={11} color="#FF5252" />}
              </View>
              <Text style={styles.chipArea} numberOfLines={1}>{area.area}</Text>
              <Text style={styles.chipVenue} numberOfLines={1}>{area.top_venue}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 1.5,
  },
  scroll: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    width: 96,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    padding: 9,
  },
  chipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  chipScore: {
    fontSize: 18,
    fontWeight: '900',
  },
  chipArea: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 1,
  },
  chipVenue: {
    fontSize: 9,
    color: '#666',
  },
});
