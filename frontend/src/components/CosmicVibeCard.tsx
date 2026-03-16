/**
 * CosmicVibeCard — Tonight's AI-powered Vibe Reading.
 *
 * Optional ambient card. Only renders meaningfully when the scout has set a
 * zodiac sign, but always shows something for everyone. Placed in the Intel
 * tab as a subtle personality layer — never front-and-centre.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getZodiacSign } from '../config/zodiac';

interface CosmicReading {
  reading:     string;
  zodiac_sign: string | null;
  city:        string;
  hot_venue:   string;
  city_mood:   string;
  powered_by:  string;
}

interface CosmicVibeCardProps {
  apiUrl:       string;
  authHeaders:  Record<string, string>;
  zodiacSign?:  string;
  isDemoMode?:  boolean;
}

const DEMO_READING: CosmicReading = {
  reading: "Lagos is charging up and the frequency tonight is in your favour. Trust the pull — the city has something lined up for scouts who move with purpose.",
  zodiac_sign: null,
  city: 'lagos',
  hot_venue: 'Quilox',
  city_mood: 'heating up fast',
  powered_by: 'demo',
};

export default function CosmicVibeCard({
  apiUrl, authHeaders, zodiacSign, isDemoMode,
}: CosmicVibeCardProps) {
  const [reading, setReading]   = useState<CosmicReading | null>(isDemoMode ? DEMO_READING : null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);
  const [revealed, setRevealed] = useState(isDemoMode ?? false);

  const sign = zodiacSign ? getZodiacSign(zodiacSign) : undefined;

  const fetch_reading = useCallback(async () => {
    if (isDemoMode) { setReading(DEMO_READING); setRevealed(true); return; }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${apiUrl}/api/cosmic-reading`, {
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setReading(data);
      setRevealed(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authHeaders, isDemoMode]);

  useEffect(() => {
    if (!isDemoMode) fetch_reading();
  }, [fetch_reading, isDemoMode]);

  // Accent color from sign element, fallback to purple
  const accentColor = sign?.elementColor ?? '#7B68EE';
  const accentDim   = accentColor + '20';
  const accentMid   = accentColor + '40';

  return (
    <View style={[s.container, { borderColor: accentMid }]}>
      <LinearGradient
        colors={[accentDim, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header row */}
      <View style={s.header}>
        <View style={s.titleRow}>
          {sign ? (
            <Text style={[s.signSymbol, { color: accentColor }]}>{sign.symbol}</Text>
          ) : (
            <Ionicons name="sparkles" size={16} color={accentColor} />
          )}
          <View>
            <Text style={s.cardTitle}>TONIGHT'S READING</Text>
            {sign && (
              <Text style={[s.signName, { color: accentColor }]}>
                {sign.name.toUpperCase()} · {sign.element.toUpperCase()}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={fetch_reading}
          style={s.refreshBtn}
          disabled={loading}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={loading ? 'hourglass-outline' : 'refresh-outline'}
            size={15}
            color="#444"
          />
        </TouchableOpacity>
      </View>

      {/* Reading body */}
      <View style={s.body}>
        {loading && !reading && (
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={accentColor} />
            <Text style={s.loadingText}>Reading the stars…</Text>
          </View>
        )}

        {error && !reading && (
          <TouchableOpacity onPress={fetch_reading} activeOpacity={0.7}>
            <Text style={s.errorText}>Couldn't reach the cosmos. Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {reading && (
          <Text style={[s.readingText, loading && { opacity: 0.4 }]}>
            {reading.reading}
          </Text>
        )}
      </View>

      {/* Footer — city mood + venue */}
      {reading && (
        <View style={s.footer}>
          <View style={[s.moodPill, { borderColor: accentColor + '30' }]}>
            <View style={[s.moodDot, { backgroundColor: accentColor }]} />
            <Text style={[s.moodText, { color: accentColor }]}>
              {reading.city_mood.toUpperCase()}
            </Text>
          </View>
          <Text style={s.venueText} numberOfLines={1}>
            {reading.hot_venue}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 0.5,
    overflow: 'hidden',
    backgroundColor: '#0A0A18',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signSymbol: {
    fontSize: 24,
    lineHeight: 28,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
  signName: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    minHeight: 44,
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#333',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  errorText: {
    fontSize: 12,
    color: '#444',
    fontStyle: 'italic',
  },
  readingText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 22,
    letterSpacing: 0.15,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  moodDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  moodText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  venueText: {
    fontSize: 11,
    color: '#444',
    fontStyle: 'italic',
    maxWidth: '55%',
    textAlign: 'right',
  },
});
