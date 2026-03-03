/**
 * ArrivalIntelCard — Best time to arrive at a venue.
 * Built from check-in timing patterns over the last 14 days.
 * Lives on the venue detail page.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface HourData {
  hour_wat: number;
  hour_label: string;
  activity: number;
}

interface ArrivalData {
  available: boolean;
  venue_name?: string;
  peak_hour?: string;
  recommended_arrival?: string;
  insight?: string;
  hourly?: HourData[];
  message?: string;
}

const DEMO: ArrivalData = {
  available: true,
  venue_name: 'DNA Nightclub',
  peak_hour: '01:00 WAT',
  recommended_arrival: '00:00 WAT',
  insight: 'Arrive by 00:00 WAT to beat the queue — peak hits around 01:00 WAT.',
  hourly: [
    { hour_wat: 20, hour_label: '20:00', activity: 2 },
    { hour_wat: 21, hour_label: '21:00', activity: 4 },
    { hour_wat: 22, hour_label: '22:00', activity: 9 },
    { hour_wat: 23, hour_label: '23:00', activity: 15 },
    { hour_wat: 0,  hour_label: '00:00', activity: 22 },
    { hour_wat: 1,  hour_label: '01:00', activity: 31 },
    { hour_wat: 2,  hour_label: '02:00', activity: 28 },
    { hour_wat: 3,  hour_label: '03:00', activity: 14 },
  ],
};

interface Props {
  venueId: string;
  isDemoMode?: boolean;
}

export default function ArrivalIntelCard({ venueId, isDemoMode }: Props) {
  const [data, setData] = useState<ArrivalData | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setData(DEMO);
      return;
    }
    fetch(`${API_URL}/api/venues/${venueId}/arrival-intel`)
      .then(r => r.json())
      .then(d => { if (d.available) setData(d); })
      .catch(() => {});
  }, [venueId, isDemoMode]);

  if (!data?.available) return null;

  const maxActivity = Math.max(...(data.hourly?.map(h => h.activity) ?? [1]));

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>ARRIVAL INTEL</Text>
        <View style={styles.peakChip}>
          <Ionicons name="time-outline" size={11} color="#FF9933" />
          <Text style={styles.peakText}>Peak: {data.peak_hour}</Text>
        </View>
      </View>

      {/* Insight text */}
      {data.insight && (
        <Text style={styles.insight}>{data.insight}</Text>
      )}

      {/* Activity bar chart */}
      {data.hourly && (
        <View style={styles.chart}>
          {data.hourly.map(h => {
            const heightPct = maxActivity > 0 ? (h.activity / maxActivity) : 0;
            const isPeak = h.hour_label === data.peak_hour?.replace(' WAT', ':00').replace(':00:00', ':00');
            const isRecommended = h.hour_label === data.recommended_arrival?.replace(' WAT', ':00').replace(':00:00', ':00');
            return (
              <View key={h.hour_label} style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, heightPct * 48),
                      backgroundColor: isPeak ? '#FF3366' : isRecommended ? '#FFD700' : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                />
                <Text style={styles.barLabel}>{h.hour_label.replace(':00', '')}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
          <Text style={styles.legendText}>Arrive {data.recommended_arrival}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF3366' }]} />
          <Text style={styles.legendText}>Peak {data.peak_hour}</Text>
        </View>
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
  peakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,153,51,0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  peakText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF9933',
  },
  insight: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 12,
    lineHeight: 18,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 60,
    marginBottom: 8,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  bar: {
    width: '80%',
    borderRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 8,
    color: '#444',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
});
