/**
 * VenueInsiderPanel
 * Personal stats for a user at a specific venue.
 * Appears automatically when the user is geofenced in — no mode labels.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface InsiderData {
  visit_count: number;
  first_visit: string | null;
  last_visit: string | null;
  personal_avg_score: number;
  peak_score: number;
  peak_date: string | null;
  taste_alignment: number;
  regularity_label: string;
  visits_this_month: number;
  last_energy: string | null;
  total_ratings_here: number;
}

const DEMO_DATA: InsiderData = {
  visit_count: 7,
  first_visit: '2025-11-14T21:00:00Z',
  last_visit: '2026-02-28T23:00:00Z',
  personal_avg_score: 81,
  peak_score: 94,
  peak_date: '2026-01-18T22:30:00Z',
  taste_alignment: 88,
  regularity_label: 'Regular',
  visits_this_month: 2,
  last_energy: 'lit',
  total_ratings_here: 7,
};

const ENERGY_LABELS: Record<string, string> = {
  quiet: 'Quiet',
  chill: 'Chill',
  warming: 'Warming Up',
  lit: 'Lit',
  peak: 'Peak',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
}

interface Props {
  venueId: string;
  venueName: string;
  vibeColor: string;
  isDemoMode: boolean;
  authHeaders: Record<string, string>;
  userName?: string;
}

export default function VenueInsiderPanel({
  venueId,
  venueName,
  vibeColor,
  isDemoMode,
  authHeaders,
  userName,
}: Props) {
  const [data, setData] = useState<InsiderData | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (isDemoMode) {
      setData(DEMO_DATA);
      setLoading(false);
      animate();
      return;
    }
    fetch(`${API_URL}/api/me/venues/${venueId}/insider`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
        animate();
      })
      .catch(() => setLoading(false));
  }, [venueId]);

  function animate() {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#C9A84C" />
      </View>
    );
  }

  if (!data) return null;

  const alignWidth = `${data.taste_alignment}%` as `${number}%`;
  const greeting = userName ? `${userName.split(' ')[0]}'s record here` : 'Your record here';

  return (
    <Animated.View style={[styles.wrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={['rgba(201,168,76,0.08)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: vibeColor }]} />
            <Text style={styles.greeting}>{greeting}</Text>
          </View>
          <View style={styles.regularityBadge}>
            <Text style={styles.regularityText}>{data.regularity_label}</Text>
          </View>
        </View>

        {/* Taste alignment bar */}
        <View style={styles.alignWrap}>
          <View style={styles.alignLabelRow}>
            <Text style={styles.alignLabel}>Taste match</Text>
            <Text style={[styles.alignPct, { color: data.taste_alignment >= 70 ? '#C9A84C' : 'rgba(255,255,255,0.5)' }]}>
              {data.taste_alignment}%
            </Text>
          </View>
          <View style={styles.alignTrack}>
            <Animated.View
              style={[styles.alignFill, { width: alignWidth, backgroundColor: data.taste_alignment >= 70 ? '#C9A84C' : '#555' }]}
            />
          </View>
        </View>

        {/* 3-column stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: vibeColor }]}>{data.peak_score}</Text>
            <Text style={styles.statKey}>PEAK SCORE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{data.visit_count}</Text>
            <Text style={styles.statKey}>VISITED</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{data.visits_this_month}</Text>
            <Text style={styles.statKey}>THIS MONTH</Text>
          </View>
        </View>

        {/* Footer: first visit + last energy */}
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.3)" />
            <Text style={styles.footerText}>First here {formatDate(data.first_visit)}</Text>
          </View>
          {data.last_energy && (
            <View style={styles.footerItem}>
              <Ionicons name="flash-outline" size={12} color="rgba(255,255,255,0.3)" />
              <Text style={styles.footerText}>Last energy: {ENERGY_LABELS[data.last_energy] ?? data.last_energy}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  wrap: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  greeting: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  regularityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  regularityText: {
    fontSize: 10,
    color: '#C9A84C',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  alignWrap: {
    marginBottom: 16,
  },
  alignLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  alignLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  alignPct: {
    fontSize: 11,
    fontWeight: '700',
  },
  alignTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
  },
  alignFill: {
    height: 3,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  statKey: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
});
