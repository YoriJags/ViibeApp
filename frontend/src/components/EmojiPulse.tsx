/**
 * EmojiPulse — frictionless one-tap ambient reactions on a venue.
 *
 * 5 emojis: fire / music / sleep / dead / bottle
 * 30-minute rolling window counts shown live.
 * One tap locks in your read. Cooldown resets hourly (server enforced).
 *
 * "No rating, no effort — just your gut in one tap."
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const EMOJIS: { key: string; glyph: string; label: string; color: string }[] = [
  { key: 'fire',   glyph: '🔥', label: 'Fire',   color: '#FF4400' },
  { key: 'music',  glyph: '🎶', label: 'Live',   color: '#9933FF' },
  { key: 'sleep',  glyph: '😴', label: 'Dead',   color: '#444466' },
  { key: 'dead',   glyph: '💀', label: 'Cooked', color: '#888' },
  { key: 'bottle', glyph: '🍾', label: 'VIP',    color: '#FFD700' },
];

const DEMO_COUNTS: Record<string, number> = {
  fire: 14, music: 6, sleep: 1, dead: 3, bottle: 9,
};

interface Props {
  venueId: string;
  isDemoMode?: boolean;
}

export default function EmojiPulse({ venueId, isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);

  const [counts, setCounts]     = useState<Record<string, number>>({});
  const [myEmoji, setMyEmoji]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  // Per-emoji bounce animations
  const bounceAnims = useRef(
    Object.fromEntries(EMOJIS.map(e => [e.key, new Animated.Value(1)]))
  ).current;

  const fetchCounts = useCallback(async () => {
    if (isDemoMode) {
      setCounts(DEMO_COUNTS);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/emoji-pulse`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts ?? {});
      }
    } catch {}
    setLoading(false);
  }, [venueId, isDemoMode]);

  useEffect(() => {
    fetchCounts();
    // Refresh every 90 seconds
    const interval = setInterval(fetchCounts, 90_000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  const handleTap = async (emojiKey: string) => {
    if (sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Bounce animation
    Animated.sequence([
      Animated.spring(bounceAnims[emojiKey], { toValue: 1.45, useNativeDriver: true, tension: 300, friction: 5 }),
      Animated.spring(bounceAnims[emojiKey], { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();

    // Optimistic update
    const prev = myEmoji;
    const isToggle = myEmoji === emojiKey;

    setCounts(c => {
      const next = { ...c };
      if (prev && prev !== emojiKey) next[prev] = Math.max(0, (next[prev] ?? 0) - 1);
      if (isToggle) {
        next[emojiKey] = Math.max(0, (next[emojiKey] ?? 0) - 1);
      } else {
        next[emojiKey] = (next[emojiKey] ?? 0) + 1;
      }
      return next;
    });
    setMyEmoji(isToggle ? null : emojiKey);

    if (isDemoMode) return;

    setSending(true);
    try {
      await fetch(`${API_URL}/api/venues/${venueId}/emoji-pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ emoji: emojiKey }),
      });
    } catch {}
    setSending(false);
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.wrap}>
      {/* Label row */}
      <View style={styles.labelRow}>
        <View style={styles.liveDot} />
        <Text style={styles.label}>PULSE</Text>
        {total > 0 && (
          <Text style={styles.totalPill}>{total} reactions · 30 min</Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#333" size="small" style={{ marginVertical: 10 }} />
      ) : (
        <View style={styles.emojiRow}>
          {EMOJIS.map(e => {
            const count  = counts[e.key] ?? 0;
            const active = myEmoji === e.key;
            return (
              <TouchableOpacity
                key={e.key}
                onPress={() => handleTap(e.key)}
                activeOpacity={0.75}
                style={[
                  styles.emojiBtn,
                  active && { borderColor: e.color + '60', backgroundColor: e.color + '15' },
                ]}
              >
                <Animated.Text
                  style={[styles.glyph, { transform: [{ scale: bounceAnims[e.key] }] }]}
                >
                  {e.glyph}
                </Animated.Text>
                {count > 0 && (
                  <Text style={[styles.count, active && { color: e.color }]}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#0C0C14',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111120',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#FF3366',
  },
  label: {
    fontSize: 9, fontWeight: '800', color: '#444', letterSpacing: 1.5,
  },
  totalPill: {
    fontSize: 9, color: '#333', fontWeight: '600', marginLeft: 4,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  emojiBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A1A26',
    backgroundColor: '#0E0E1A',
    gap: 3,
  },
  glyph: { fontSize: 20 },
  count: {
    fontSize: 10, fontWeight: '800', color: '#555',
  },
});
