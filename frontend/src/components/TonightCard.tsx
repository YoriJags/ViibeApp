/**
 * TonightCard — "The Move Tonight" single recommendation.
 * One venue. One headline. Why you should go.
 * Fetches from GET /api/tonight/{city}.
 * Lives at the top of the home feed.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface TonightData {
  available: boolean;
  is_night_hours: boolean;
  headline: string;
  top_pick: {
    venue_id: string;
    venue_name: string;
    area: string;
    score: number;
    velocity: string;
    music_genre?: string;
    entry_fee?: string;
  };
  alternatives: { venue_id: string; venue_name: string; area: string; score: number }[];
  weather_note?: string;
}

const DEMO: TonightData = {
  available: true,
  is_night_hours: true,
  headline: "DNA Nightclub is the move — 94% and still climbing",
  top_pick: {
    venue_id: '1',
    venue_name: 'DNA Nightclub',
    area: 'Victoria Island',
    score: 94,
    velocity: 'heating_up',
    music_genre: 'Afrobeats',
    entry_fee: '₦5,000',
  },
  alternatives: [
    { venue_id: '2', venue_name: 'Club Quilox', area: 'Lekki', score: 81 },
    { venue_id: '3', venue_name: 'The Hard Rock', area: 'Ikoyi', score: 66 },
  ],
  weather_note: 'Dry night — expect peak turnout',
};

interface Props {
  city: string;
  isDemoMode?: boolean;
  onVenuePress?: (venueId: string) => void;
}

export default function TonightCard({ city, isDemoMode, onVenuePress }: Props) {
  const [data, setData] = useState<TonightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      setData(DEMO);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/tonight/${city}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [city, isDemoMode]);

  if (loading) return null;
  if (!data?.available) return null;

  const { top_pick, alternatives, weather_note, headline, is_night_hours } = data;

  return (
    <LinearGradient
      colors={['rgba(255,51,102,0.12)', 'rgba(255,153,51,0.06)', 'rgba(13,17,23,0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Label */}
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Ionicons name="navigate" size={10} color="#FF3366" />
          <Text style={styles.badgeText}>THE MOVE TONIGHT</Text>
        </View>
        {!is_night_hours && (
          <Text style={styles.earlyNote}>Based on current data</Text>
        )}
      </View>

      {/* Headline */}
      <Text style={styles.headline}>{headline}</Text>

      {/* Top pick */}
      <TouchableOpacity
        style={styles.pickRow}
        onPress={() => onVenuePress?.(top_pick.venue_id)}
        activeOpacity={0.8}
      >
        <View style={styles.pickInfo}>
          <Text style={styles.pickName}>{top_pick.venue_name}</Text>
          <View style={styles.pickMeta}>
            <Text style={styles.pickArea}>{top_pick.area}</Text>
            {top_pick.music_genre && <Text style={styles.pickDot}>·</Text>}
            {top_pick.music_genre && <Text style={styles.pickGenre}>{top_pick.music_genre}</Text>}
            {top_pick.entry_fee && <Text style={styles.pickDot}>·</Text>}
            {top_pick.entry_fee && <Text style={styles.pickFee}>{top_pick.entry_fee}</Text>}
          </View>
        </View>
        <View style={styles.pickScore}>
          <Text style={styles.pickScoreVal}>{top_pick.score}%</Text>
          {top_pick.velocity === 'heating_up' && (
            <Ionicons name="trending-up" size={14} color="#4CAF50" />
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#555" style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* Weather note */}
      {weather_note && (
        <View style={styles.weatherRow}>
          <Ionicons name="partly-sunny-outline" size={12} color="#FFD700" />
          <Text style={styles.weatherText}>{weather_note}</Text>
        </View>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <View style={styles.altRow}>
          <Text style={styles.altLabel}>Also: </Text>
          {alternatives.map((alt, i) => (
            <TouchableOpacity
              key={alt.venue_id}
              onPress={() => onVenuePress?.(alt.venue_id)}
              style={styles.altChip}
              activeOpacity={0.7}
            >
              <Text style={styles.altChipText}>{alt.venue_name} {alt.score}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.15)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,51,102,0.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 1.5,
  },
  earlyNote: {
    fontSize: 9,
    color: '#555',
  },
  headline: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 10,
    lineHeight: 22,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,51,102,0.07)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  pickInfo: {
    flex: 1,
  },
  pickName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 3,
  },
  pickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  pickArea: {
    fontSize: 11,
    color: '#888',
  },
  pickDot: {
    fontSize: 11,
    color: '#444',
  },
  pickGenre: {
    fontSize: 11,
    color: '#888',
  },
  pickFee: {
    fontSize: 11,
    color: '#888',
  },
  pickScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickScoreVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FF3366',
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  weatherText: {
    fontSize: 11,
    color: '#888',
    flex: 1,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  altLabel: {
    fontSize: 11,
    color: '#555',
  },
  altChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  altChipText: {
    fontSize: 10,
    color: '#AAA',
  },
});
