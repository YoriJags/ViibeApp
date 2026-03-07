/**
 * BlastAttributionCard — Merchant ROI proof for live blasts.
 * "Your blast reached 340 scouts. 23 checked in. Est. ₦184,000 revenue."
 * This is the "I will pay monthly forever" moment for merchants.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function formatNGN(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
  return `₦${n}`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff}d ago`;
}

interface BlastResult {
  blast_id: string;
  message: string;
  sent_at: string;
  followers_reached: number;
  visits_2h: number;
  conversion_rate: number;
  estimated_revenue_ngn: number;
}

interface AttributionData {
  blasts: BlastResult[];
  summary: {
    total_blasts: number;
    total_verified_visits: number;
    total_estimated_revenue_ngn: number;
    avg_conversion_rate: number;
  };
}

interface Props {
  venueId: string;
  authToken: string;
  demoData?: AttributionData;
}

export default function BlastAttributionCard({ venueId, authToken, demoData }: Props) {
  const [data, setData] = useState<AttributionData | null>(demoData ?? null);
  const [loading, setLoading] = useState(!demoData);
  const [expanded, setExpanded] = useState(false);

  const fetchAttribution = useCallback(async () => {
    if (demoData) return;
    try {
      const res = await fetch(`${API_URL}/api/merchant/venues/${venueId}/blast-attribution`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [venueId, authToken, demoData]);

  useEffect(() => { fetchAttribution(); }, [fetchAttribution]);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="small" color="#FF3366" /></View>;
  if (!data || data.blasts.length === 0) return null;

  const { summary, blasts } = data;

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
        <View>
          <Text style={styles.title}>BLAST PERFORMANCE</Text>
          <Text style={styles.subtitle}>Scout-verified ROI from your live pushes</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#555" />
      </TouchableOpacity>

      {/* Summary strip — always visible */}
      <LinearGradient colors={['#FF336615', '#FF336605']} style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.total_verified_visits}</Text>
          <Text style={styles.summaryLabel}>Verified visits</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
            {formatNGN(summary.total_estimated_revenue_ngn)}
          </Text>
          <Text style={styles.summaryLabel}>Est. revenue</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.avg_conversion_rate}%</Text>
          <Text style={styles.summaryLabel}>Avg conversion</Text>
        </View>
      </LinearGradient>

      {/* Blast list */}
      {expanded && (
        <View style={styles.list}>
          {blasts.map((blast, i) => (
            <View key={blast.blast_id || i} style={styles.blastCard}>
              <Text style={styles.blastMessage} numberOfLines={2}>{blast.message}</Text>
              <Text style={styles.blastTime}>{timeAgo(blast.sent_at)}</Text>

              {/* Funnel: reach → visits → revenue */}
              <View style={styles.funnel}>
                <View style={styles.funnelStep}>
                  <Ionicons name="megaphone-outline" size={13} color="#888" />
                  <Text style={styles.funnelValue}>{blast.followers_reached}</Text>
                  <Text style={styles.funnelLabel}>reached</Text>
                </View>
                <Ionicons name="arrow-forward" size={12} color="#333" />
                <View style={styles.funnelStep}>
                  <Ionicons name="walk-outline" size={13} color="#FF9933" />
                  <Text style={[styles.funnelValue, { color: '#FF9933' }]}>{blast.visits_2h}</Text>
                  <Text style={styles.funnelLabel}>visited</Text>
                </View>
                <Ionicons name="arrow-forward" size={12} color="#333" />
                <View style={styles.funnelStep}>
                  <Ionicons name="cash-outline" size={13} color="#4CAF50" />
                  <Text style={[styles.funnelValue, { color: '#4CAF50' }]}>
                    {formatNGN(blast.estimated_revenue_ngn)}
                  </Text>
                  <Text style={styles.funnelLabel}>est. revenue</Text>
                </View>
                <View style={styles.conversionChip}>
                  <Text style={styles.conversionText}>{blast.conversion_rate}%</Text>
                </View>
              </View>
            </View>
          ))}

          <Text style={styles.disclaimer}>
            * Visits = unique scouts who rated this venue within 2h of blast. Revenue estimated at ₦8,000 avg spend.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111118',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252530',
    marginVertical: 8,
    overflow: 'hidden',
  },
  loading: { padding: 20, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 10, fontWeight: '800', color: '#FF3366', letterSpacing: 2 },
  subtitle: { fontSize: 11, color: '#555', marginTop: 2 },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#FF336625',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  summaryLabel: { fontSize: 9, color: '#555', fontWeight: '600', letterSpacing: 0.5 },
  divider: { width: 1, height: 28, backgroundColor: '#FF336625' },
  list: { padding: 12, gap: 10 },
  blastCard: {
    backgroundColor: '#0D0D14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E2A',
    padding: 12,
    gap: 8,
  },
  blastMessage: { fontSize: 12, color: '#CCC', lineHeight: 18 },
  blastTime: { fontSize: 10, color: '#444' },
  funnel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  funnelStep: { alignItems: 'center', gap: 2, minWidth: 50 },
  funnelValue: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  funnelLabel: { fontSize: 8, color: '#555', letterSpacing: 0.5 },
  conversionChip: {
    marginLeft: 'auto' as any,
    backgroundColor: '#FF336615',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FF336630',
  },
  conversionText: { fontSize: 11, fontWeight: '800', color: '#FF3366' },
  disclaimer: { fontSize: 9, color: '#333', lineHeight: 14, marginTop: 4 },
});
