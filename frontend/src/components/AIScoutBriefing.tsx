/**
 * AIScoutBriefing — Personalised Claude-powered morning/evening/night message.
 *
 * Pulls scout stats + crew status + top venues → Claude writes a 2-3 sentence
 * Lagos-style briefing. Appears as a card on the home screen feed.
 *
 * Refreshes every 30 min (matches backend cache TTL).
 * Tap to expand; tap refresh to force a new fetch.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const DEMO_BRIEFINGS: Record<string, string> = {
  morning: "Oga scout, good morning! Lagos is still catching its breath from last night — Quilox peaked at 94% and nearly 40 scouts passed through. Check your DNA card; you're moving up the rankings fast. Hit a venue tonight and keep that momentum going.",
  evening: "E don dey time! The city is starting to wake up — energy is building at Club DNA and Escape. Your cartel has 3 members confirmed for tonight, so coordinate before the best spots fill up. First scout to drop a rating gets double clout.",
  night:   "The night is LIVE right now. Quilox is at peak, Escape is lit — scouts are rating in real time. Your crew is out, the leaderboard is moving. Drop a rating and secure your position before midnight resets the count.",
};

interface Props {
  city?:       string;
  isDemoMode?: boolean;
}

export default function AIScoutBriefing({ city = 'lagos', isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);

  const [briefing, setBriefing]       = useState('');
  const [aiPowered, setAiPowered]     = useState(false);
  const [timeCtx, setTimeCtx]         = useState<string>('evening');
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const TIME_LABELS: Record<string, { icon: string; label: string }> = {
    morning: { icon: 'sunny-outline',  label: 'MORNING BRIEF' },
    evening: { icon: 'partly-sunny-outline', label: 'EVENING BRIEF' },
    night:   { icon: 'moon-outline',   label: 'NIGHT BRIEF' },
  };

  const fetchBriefing = useCallback(async (force = false) => {
    if (isDemoMode) {
      const hour = new Date().getHours();
      const ctx = hour >= 6 && hour < 14 ? 'morning' : hour >= 14 && hour < 20 ? 'evening' : 'night';
      setTimeCtx(ctx);
      setBriefing(DEMO_BRIEFINGS[ctx]);
      setAiPowered(false);
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/scout-briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ city }),
      });
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing ?? '');
        setAiPowered(data.ai_powered ?? false);
        setTimeCtx(data.time_context ?? 'evening');
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }
    } catch {}
    setLoading(false);
  }, [city, isDemoMode, getAuthHeaders]);

  useEffect(() => {
    fetchBriefing();
    const t = setInterval(() => fetchBriefing(), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchBriefing]);

  if (!loading && !briefing) return null;

  const tl = TIME_LABELS[timeCtx] ?? TIME_LABELS.evening;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#0E0820', '#090914']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <Ionicons name={tl.icon as any} size={12} color="#9933FF" />
            <Text style={styles.label}>{tl.label}</Text>
            {aiPowered && (
              <View style={styles.aiPill}>
                <Ionicons name="sparkles" size={8} color="#9933FF" />
                <Text style={styles.aiPillText}>CLAUDE</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => fetchBriefing(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={14} color="#444" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#9933FF" />
            <Text style={styles.loadingText}>Reading the city...</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.85}>
            <Animated.Text
              style={[styles.briefingText, { opacity: fadeAnim }]}
              numberOfLines={expanded ? undefined : 3}
            >
              {briefing}
            </Animated.Text>
            {!expanded && briefing.length > 140 && (
              <Text style={styles.readMore}>Read more</Text>
            )}
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9933FF22',
    padding: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 9, fontWeight: '800', color: '#9933FF', letterSpacing: 1.5 },
  aiPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#9933FF18', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: '#9933FF33',
  },
  aiPillText: { fontSize: 7, fontWeight: '800', color: '#9933FF', letterSpacing: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  loadingText: { fontSize: 12, color: '#555', fontWeight: '500' },
  briefingText: { fontSize: 13, color: '#CCC', lineHeight: 20, fontWeight: '400' },
  readMore: { fontSize: 11, color: '#9933FF', fontWeight: '600', marginTop: 4 },
});
