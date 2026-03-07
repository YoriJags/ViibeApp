/**
 * HeatMapCard — City venue heat intensity overview.
 *
 * Shows Lagos neighborhoods ranked by live vibe heat.
 * Color-coded grid: dead → electric. Each cell = one area.
 * Bolt velocity + vibe score combined into a single heat number.
 *
 * No map dependency needed — pure data visualization.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AreaHeat {
  area: string;
  venue_count: number;
  avg_heat: number;
  bolt_total_1h: number;
  top_venue: string;
}

const DEMO_AREAS: AreaHeat[] = [
  { area: 'Victoria Island', venue_count: 4, avg_heat: 82, bolt_total_1h: 67, top_venue: 'DNA Nightclub' },
  { area: 'Lekki',           venue_count: 3, avg_heat: 71, bolt_total_1h: 43, top_venue: 'Escape Lagos' },
  { area: 'Ikeja',           venue_count: 3, avg_heat: 58, bolt_total_1h: 28, top_venue: 'Hard Rock Cafe' },
  { area: 'Ikoyi',           venue_count: 2, avg_heat: 45, bolt_total_1h: 12, top_venue: 'DropShot Bar' },
  { area: 'Surulere',        venue_count: 2, avg_heat: 34, bolt_total_1h: 7,  top_venue: 'Jazzhole' },
  { area: 'Yaba',            venue_count: 1, avg_heat: 18, bolt_total_1h: 2,  top_venue: 'Terra Kulture' },
];

function heatColor(heat: number): string {
  if (heat >= 80) return '#FF3366';
  if (heat >= 65) return '#FF8C00';
  if (heat >= 50) return '#9933FF';
  if (heat >= 35) return '#6655FF';
  if (heat >= 20) return '#3399FF';
  return '#2A2A4A';
}

function heatLabel(heat: number): string {
  if (heat >= 80) return 'PEAK';
  if (heat >= 65) return 'LIT';
  if (heat >= 50) return 'CHARGED';
  if (heat >= 35) return 'WARMING';
  if (heat >= 20) return 'CHILL';
  return 'QUIET';
}

interface Props {
  city?: string;
  isDemoMode?: boolean;
}

export default function HeatMapCard({ city = 'lagos', isDemoMode }: Props) {
  const [areas, setAreas] = useState<AreaHeat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) { setAreas(DEMO_AREAS); setLoading(false); return; }
    fetch(`${API_URL}/api/heat-map/${city}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.areas) setAreas(d.areas); setLoading(false); })
      .catch(() => setLoading(false));
  }, [city, isDemoMode]);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#FF3366" />
        <Text style={styles.loadingText}>Reading the city...</Text>
      </View>
    );
  }

  if (!areas.length) return null;

  const topArea = areas[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="map" size={13} color="#FF3366" />
          <Text style={styles.headerLabel}>CITY HEAT MAP</Text>
        </View>
        <Text style={styles.headerCity}>{city.toUpperCase()}</Text>
      </View>

      {/* Hottest zone callout */}
      <View style={[styles.hotZone, { borderColor: heatColor(topArea.avg_heat) + '55', backgroundColor: heatColor(topArea.avg_heat) + '12' }]}>
        <Ionicons name="flame" size={14} color={heatColor(topArea.avg_heat)} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.hotZoneArea, { color: heatColor(topArea.avg_heat) }]}>{topArea.area}</Text>
          <Text style={styles.hotZoneVenue}>{topArea.top_venue} · {topArea.bolt_total_1h} bolts/hr</Text>
        </View>
        <Text style={[styles.hotZoneHeat, { color: heatColor(topArea.avg_heat) }]}>{topArea.avg_heat}</Text>
      </View>

      {/* Area grid */}
      <View style={styles.grid}>
        {areas.map((a, i) => {
          const color = heatColor(a.avg_heat);
          const barPct = `${a.avg_heat}%`;
          return (
            <View key={a.area} style={styles.areaRow}>
              <View style={styles.areaRank}>
                <Text style={[styles.rankNum, { color: i < 3 ? color : '#2A2A4A' }]}>{i + 1}</Text>
              </View>
              <View style={styles.areaInfo}>
                <View style={styles.areaTopRow}>
                  <Text style={styles.areaName} numberOfLines={1}>{a.area}</Text>
                  <Text style={[styles.heatBadge, { color, backgroundColor: color + '18' }]}>{heatLabel(a.avg_heat)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: barPct, backgroundColor: color }]} />
                </View>
                <Text style={styles.areaMeta}>{a.venue_count} venues · {a.bolt_total_1h} bolts/hr</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0C15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1C1C2C',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  loadingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, padding: 14,
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C',
  },
  loadingText: { color: '#3A3A4E', fontSize: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 9, color: '#FF3366', fontWeight: '800', letterSpacing: 1.5 },
  headerCity: { fontSize: 9, color: '#2A2A4A', fontWeight: '700', letterSpacing: 1.5 },
  hotZone: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  hotZoneArea: { fontSize: 14, fontWeight: '900' },
  hotZoneVenue: { fontSize: 10, color: '#555', fontWeight: '500', marginTop: 1 },
  hotZoneHeat: { fontSize: 28, fontWeight: '900', lineHeight: 30 },
  grid: { gap: 10 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  areaRank: { width: 18, alignItems: 'center' },
  rankNum: { fontSize: 11, fontWeight: '900' },
  areaInfo: { flex: 1, gap: 3 },
  areaTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaName: { fontSize: 12, fontWeight: '700', color: '#CCC', flex: 1 },
  heatBadge: { fontSize: 8, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  barTrack: { height: 3, backgroundColor: '#111120', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  areaMeta: { fontSize: 9, color: '#3A3A4E', fontWeight: '500' },
});
