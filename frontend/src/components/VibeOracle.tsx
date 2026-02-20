/**
 * VibeOracle — Predictive venue intelligence card.
 * "Quilox will be electric by 12:30am tonight (89% confidence)"
 * Appears above VibeForecast on the venue detail page.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';
import { DEMO_ORACLE_PREDICTIONS, DEMO_ORACLE_DEFAULT } from '../data/demoData';

interface OracleSignal { icon: string; label: string; type: string; }

interface OraclePrediction {
  venue_id: string;
  headline: string;
  confidence: number;
  peak_window_start: string;
  peak_window_end: string;
  best_arrival: string;
  current_trajectory: 'rising' | 'peaking' | 'fading' | 'quiet';
  signals: OracleSignal[];
  generated_at: string;
  insufficient_data?: boolean;
}

interface VibeOracleProps {
  venueId: string;
  venueName?: string;
}

const TRAJECTORY_COLOR: Record<string, string> = {
  rising: '#FF9800',
  peaking: '#00E676',
  fading: '#9933FF',
  quiet: '#666',
};

const TRAJECTORY_ICON: Record<string, string> = {
  rising: 'trending-up',
  peaking: 'flash',
  fading: 'trending-down',
  quiet: 'moon',
};

function confidenceColor(c: number) {
  if (c >= 80) return '#00E676';
  if (c >= 60) return '#FFD700';
  return '#FF9933';
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function VibeOracle({ venueId, venueName }: VibeOracleProps) {
  const { isDemoMode } = useVibeStore();
  const [prediction, setPrediction] = useState<OraclePrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venueId) return;
    fetchOracle();
  }, [venueId]);

  const fetchOracle = async () => {
    setLoading(true);
    if (isDemoMode) {
      const demo = DEMO_ORACLE_PREDICTIONS[venueId] ?? DEMO_ORACLE_DEFAULT;
      setTimeout(() => {
        setPrediction(demo as OraclePrediction);
        setLoading(false);
      }, 300);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/oracle`);
      if (res.ok) {
        const data = await res.json();
        if (!data.insufficient_data) {
          setPrediction(data);
        }
      }
    } catch {
      // Non-critical — fail silently
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FFD700" />
      </View>
    );
  }

  if (!prediction) return null;

  const tColor = TRAJECTORY_COLOR[prediction.current_trajectory] ?? '#FF9800';
  const tIcon = TRAJECTORY_ICON[prediction.current_trajectory] ?? 'trending-up';

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['#1A0A1A', '#0D0A1F']}
        style={styles.container}
      >
        {/* Gold left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: '#FFD700' }]} />

        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.labelRow}>
              <Ionicons name="eye" size={13} color="#FFD700" />
              <Text style={styles.oracleLabel}>VIBE ORACLE</Text>
            </View>
            <View style={[styles.confidenceBadge, { borderColor: confidenceColor(prediction.confidence) + '60', backgroundColor: confidenceColor(prediction.confidence) + '18' }]}>
              <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(prediction.confidence) }]} />
              <Text style={[styles.confidenceText, { color: confidenceColor(prediction.confidence) }]}>
                {prediction.confidence}% confidence
              </Text>
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>{prediction.headline}</Text>

          {/* Best arrival + trajectory */}
          <View style={styles.subRow}>
            <View style={styles.arrivalRow}>
              <Ionicons name="time-outline" size={13} color="#888" />
              <Text style={styles.arrivalText}>Best time to arrive: {prediction.best_arrival}</Text>
            </View>
            <View style={[styles.trajectoryChip, { backgroundColor: tColor + '20', borderColor: tColor + '50' }]}>
              <Ionicons name={tIcon as any} size={11} color={tColor} />
              <Text style={[styles.trajectoryText, { color: tColor }]}>
                {prediction.current_trajectory.charAt(0).toUpperCase() + prediction.current_trajectory.slice(1)}
              </Text>
            </View>
          </View>

          {/* Signal chips */}
          <View style={styles.signalsRow}>
            {prediction.signals.map((signal, i) => (
              <View key={i} style={styles.signalChip}>
                <Text style={styles.signalEmoji}>{signal.icon}</Text>
                <Text style={styles.signalLabel}>{signal.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  loadingContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  oracleLabel: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headline: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  arrivalText: {
    color: '#999',
    fontSize: 12,
  },
  trajectoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  trajectoryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  signalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  signalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  signalEmoji: {
    fontSize: 12,
  },
  signalLabel: {
    color: '#CCC',
    fontSize: 11,
    fontWeight: '500',
  },
});
