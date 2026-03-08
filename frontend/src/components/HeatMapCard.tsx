/**
 * HeatMapCard — City venue heat intensity overview.
 *
 * Shows Lagos neighborhoods ranked by live vibe heat.
 * Color-coded grid: dead → electric. Each cell = one area.
 * Expand button opens fullscreen city heat map with more detail.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Modal, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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

const HEAT_LEGEND = [
  { label: 'QUIET',   color: '#2A2A4A' },
  { label: 'CHILL',   color: '#3399FF' },
  { label: 'WARMING', color: '#6655FF' },
  { label: 'CHARGED', color: '#9933FF' },
  { label: 'LIT',     color: '#FF8C00' },
  { label: 'PEAK',    color: '#FF3366' },
];

interface Props {
  city?: string;
  isDemoMode?: boolean;
}

// ── Shared area row ────────────────────────────────────────────────────────────
function AreaRow({ area, index, fullscreen = false }: { area: AreaHeat; index: number; fullscreen?: boolean }) {
  const color = heatColor(area.avg_heat);
  return (
    <View style={[styles.areaRow, fullscreen && fs.areaRow]}>
      <View style={styles.areaRank}>
        <Text style={[styles.rankNum, { color: index < 3 ? color : '#2A2A4A' }]}>{index + 1}</Text>
      </View>
      <View style={styles.areaInfo}>
        <View style={styles.areaTopRow}>
          <Text style={[styles.areaName, fullscreen && fs.areaName]} numberOfLines={1}>{area.area}</Text>
          <Text style={[styles.heatBadge, { color, backgroundColor: color + '18' }]}>{heatLabel(area.avg_heat)}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${area.avg_heat}%` as any, backgroundColor: color }]} />
        </View>
        {fullscreen ? (
          <View style={fs.metaRow}>
            <Text style={styles.areaMeta}>{area.venue_count} venues · {area.bolt_total_1h} bolts/hr</Text>
            <Text style={fs.topVenue}>🏆 {area.top_venue}</Text>
          </View>
        ) : (
          <Text style={styles.areaMeta}>{area.venue_count} venues · {area.bolt_total_1h} bolts/hr</Text>
        )}
      </View>
      {fullscreen && (
        <Text style={[fs.heatScore, { color }]}>{area.avg_heat}</Text>
      )}
    </View>
  );
}

export default function HeatMapCard({ city = 'lagos', isDemoMode }: Props) {
  const [areas, setAreas] = useState<AreaHeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (isDemoMode) { setAreas(DEMO_AREAS); setLoading(false); return; }
    fetch(`${API_URL}/api/heat-map/${city}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.areas) setAreas(d.areas); setLoading(false); })
      .catch(() => setLoading(false));
  }, [city, isDemoMode]);

  if (loading) return (
    <View style={styles.loadingCard}>
      <ActivityIndicator size="small" color="#FF3366" />
      <Text style={styles.loadingText}>Reading the city...</Text>
    </View>
  );

  if (!areas.length) return null;

  const topArea = areas[0];

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="map" size={13} color="#FF3366" />
            <Text style={styles.headerLabel}>CITY HEAT MAP</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerCity}>{city.toUpperCase()}</Text>
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFullscreen(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="expand-outline" size={15} color="#555" />
            </TouchableOpacity>
          </View>
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
          {areas.map((a, i) => <AreaRow key={a.area} area={a} index={i} />)}
        </View>
      </View>

      {/* Fullscreen Modal */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <View style={fs.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={{ flex: 1 }}>
            {/* FS Header */}
            <View style={fs.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="map" size={18} color="#FF3366" />
                <Text style={fs.title}>CITY HEAT MAP</Text>
                <Text style={fs.cityChip}>{city.toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              {/* Top area hero */}
              <View style={[fs.heroCard, { borderColor: heatColor(topArea.avg_heat) + '50', backgroundColor: heatColor(topArea.avg_heat) + '0E' }]}>
                <Ionicons name="flame" size={20} color={heatColor(topArea.avg_heat)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={fs.heroLabel}>HOTTEST ZONE RIGHT NOW</Text>
                  <Text style={[fs.heroArea, { color: heatColor(topArea.avg_heat) }]}>{topArea.area}</Text>
                  <Text style={fs.heroMeta}>{topArea.top_venue} · {topArea.bolt_total_1h} bolts/hr · {topArea.venue_count} venues</Text>
                </View>
                <Text style={[fs.heroScore, { color: heatColor(topArea.avg_heat) }]}>{topArea.avg_heat}</Text>
              </View>

              {/* Full area list */}
              <View style={fs.areaList}>
                {areas.map((a, i) => <AreaRow key={a.area} area={a} index={i} fullscreen />)}
              </View>

              {/* Legend */}
              <View style={fs.legend}>
                {HEAT_LEGEND.map(l => (
                  <View key={l.label} style={fs.legendItem}>
                    <View style={[fs.legendDot, { backgroundColor: l.color }]} />
                    <Text style={[fs.legendLabel, { color: l.color }]}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1,
    borderColor: '#1C1C2C', padding: 14, marginHorizontal: 16, marginTop: 12,
  },
  loadingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, padding: 14,
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C',
  },
  loadingText: { color: '#3A3A4E', fontSize: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLabel: { fontSize: 9, color: '#FF3366', fontWeight: '800', letterSpacing: 1.5 },
  headerCity: { fontSize: 9, color: '#2A2A4A', fontWeight: '700', letterSpacing: 1.5 },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
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

const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  cityChip: {
    fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 2,
    backgroundColor: '#1A1A28', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { paddingBottom: 40 },
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, borderRadius: 16, borderWidth: 1, padding: 16,
  },
  heroLabel: { fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 1.5 },
  heroArea: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  heroMeta: { fontSize: 11, color: '#555' },
  heroScore: { fontSize: 44, fontWeight: '900', lineHeight: 46 },
  areaList: { marginHorizontal: 16, gap: 14 },
  areaRow: { paddingVertical: 4 },
  areaName: { fontSize: 14, fontWeight: '700' },
  heatScore: { fontSize: 22, fontWeight: '900', width: 44, textAlign: 'right' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topVenue: { fontSize: 9, color: '#555', fontWeight: '600' },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
    marginHorizontal: 16, marginTop: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#1A1A28',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
});
