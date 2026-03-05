/**
 * InsiderFeed — Scene intelligence view for Insider Mode.
 * No rating prompts, no clout. Clean signal: sorted venue intel + scene sentences.
 * Previously an inline function inside (public)/index.tsx.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ErrorBoundary from './ErrorBoundary';
import LivePushFeed from './LivePushFeed';
import { getSceneIntelShort } from '../utils/sceneIntel';

interface InsiderFeedProps {
  venues: any[];
  cityPulse: any;
  cityName: string;
  onVenuePress: (id: string) => void;
  onSwitchMode: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function InsiderFeed({
  venues,
  cityPulse,
  cityName,
  onVenuePress,
  onSwitchMode,
  refreshing,
  onRefresh,
}: InsiderFeedProps) {
  const pulse_score = cityPulse?.pulse_score ?? 0;
  const pulse_label = (cityPulse?.pulse_label ?? 'CHILL').toUpperCase();

  const accentColor =
    pulse_score >= 80 ? '#FF3366' :
    pulse_score >= 60 ? '#FF9933' :
    pulse_score >= 30 ? '#9933FF' :
    '#3399FF';

  const topVenues = [...venues]
    .filter((v: any) => (v.current_vibe_score ?? 0) >= 40)
    .sort((a: any, b: any) => (b.current_vibe_score ?? 0) - (a.current_vibe_score ?? 0))
    .slice(0, 10);

  const quietVenues = venues.filter((v: any) => (v.current_vibe_score ?? 0) < 40);

  const scoreColor = (s: number) =>
    s >= 80 ? '#FF3366' : s >= 60 ? '#FF9933' : s >= 40 ? '#9933FF' : '#3399FF';

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9933FF" />
      }
      contentContainerStyle={styles.scroll}
    >
      {/* Intel Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TONIGHT'S INTEL</Text>
          <Text style={[styles.headerSub, { color: accentColor }]}>
            {cityName} — {pulse_label} · {pulse_score}%
          </Text>
        </View>
        <TouchableOpacity style={styles.switchBtn} onPress={onSwitchMode} activeOpacity={0.75}>
          <Ionicons name="swap-horizontal" size={13} color="#888" />
          <Text style={styles.switchBtnText}>Scout Mode</Text>
        </TouchableOpacity>
      </View>

      <ErrorBoundary label="Live Push Feed">
        <LivePushFeed />
      </ErrorBoundary>

      {topVenues.length > 0 && (
        <View style={styles.sectionRow}>
          <View style={[styles.sectionDot, { backgroundColor: accentColor }]} />
          <Text style={styles.sectionLabel}>ACTIVE VENUES · SORTED BY ENERGY</Text>
        </View>
      )}

      {topVenues.map((venue: any) => {
        const score = venue.current_vibe_score ?? 0;
        const intel = getSceneIntelShort({
          name: venue.name,
          venue_type: venue.venue_type ?? 'bar',
          current_vibe_score: score,
          energy_level: venue.energy_level ?? 'chill',
          capacity_level: venue.capacity_level ?? 'sparse',
          gate_level: venue.gate_level ?? 'clear',
          vibe_velocity: venue.vibe_velocity ?? 'stable',
        });
        const col = scoreColor(score);

        return (
          <TouchableOpacity
            key={venue.id}
            style={styles.venueCard}
            onPress={() => onVenuePress(venue.id)}
            activeOpacity={0.8}
          >
            <View style={styles.venueScoreBlock}>
              <Text style={[styles.venueScore, { color: col }]}>{Math.round(score)}</Text>
              <View style={[styles.scoreDot, { backgroundColor: col }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
              <Text style={styles.venueArea} numberOfLines={1}>{venue.area || venue.district || ''}</Text>
              <Text style={styles.venueIntel} numberOfLines={2}>{intel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#333" />
          </TouchableOpacity>
        );
      })}

      {quietVenues.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <View style={[styles.sectionDot, { backgroundColor: '#333' }]} />
            <Text style={styles.sectionLabel}>QUIET / NOT THE MOVE YET</Text>
          </View>
          {quietVenues.map((venue: any) => (
            <TouchableOpacity
              key={venue.id}
              style={[styles.venueCard, { opacity: 0.55 }]}
              onPress={() => onVenuePress(venue.id)}
              activeOpacity={0.75}
            >
              <View style={styles.venueScoreBlock}>
                <Text style={[styles.venueScore, { color: '#444', fontSize: 22 }]}>
                  {Math.round(venue.current_vibe_score ?? 0)}
                </Text>
                <View style={[styles.scoreDot, { backgroundColor: '#333' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.venueName, { color: '#666' }]} numberOfLines={1}>{venue.name}</Text>
                <Text style={styles.venueArea} numberOfLines={1}>{venue.area || ''}</Text>
                <Text style={[styles.venueIntel, { color: '#444' }]}>Not the move right now.</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#222" />
            </TouchableOpacity>
          ))}
        </>
      )}

      {venues.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No venues loaded yet. Pull to refresh.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  headerSub: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchBtnText: { fontSize: 11, color: '#666', fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionDot: { width: 5, height: 5, borderRadius: 2.5 },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: '#444', letterSpacing: 1.5 },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#0F0F16',
  },
  venueScoreBlock: { width: 48, alignItems: 'center', gap: 4 },
  venueScore: { fontSize: 28, fontWeight: '900', letterSpacing: -1, lineHeight: 30 },
  scoreDot: { width: 4, height: 4, borderRadius: 2 },
  venueName: { fontSize: 15, fontWeight: '800', color: '#EEE', marginBottom: 1 },
  venueArea: { fontSize: 11, color: '#444', marginBottom: 4, fontWeight: '500' },
  venueIntel: { fontSize: 12, color: '#777', lineHeight: 17 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#444', fontSize: 14 },
});
