/**
 * AIPulseComment — Claude-powered live scene blurb for a venue.
 * Fetches from POST /api/venues/:id/ai-pulse with current vibe data.
 * Falls back to Vibe Master templates if Claude isn't available.
 * "Quilox don go mad — 89% energy, full house, DJ is on fire right now."
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Demo commentary indexed by energy level
const DEMO_COMMENTS: Record<string, string[]> = {
  peak: [
    "The crowd don reach maximum. DJ no dey rest, energy dey scatter everywhere — if you no dey here, you go regret am.",
    "This place don turn into another dimension tonight. Everyone dey vibe, nobody wan leave. Pull up now before e close.",
    "Omo, the energy for this place is something else entirely. 🔥 Wall to wall, vibes on levels — this is the one tonight.",
  ],
  lit: [
    "E dey build nicely. The dance floor don start to fill, DJ dey test the waters — give am 30 minutes and e go scatter.",
    "Scene dey warm up proper. Good crowd, right energy — if you move now you'll catch the peak wave.",
    "Things are looking good here. Right people, right energy, right time. Slide through before e full up.",
  ],
  charged: [
    "The electricity is real tonight. You can feel it — conversations loud, drinks flowing, the DJ just switched gear.",
    "Charged and ready to go off. Everyone's tuned in, waiting for the moment to drop. Could be the night's best.",
    "Something's building here. The energy is at that sweet spot — not peak yet but you can feel the pressure rising.",
  ],
  warming: [
    "Still finding its rhythm but the potential is there. Early crowd has good energy — give it time.",
    "Lowkey vibes right now. Perfect if you want to ease in before the scene gets loud. Smart move.",
    "Dey warm up. The right people dey trickle in. Check back in an hour — this could be the surprise of the night.",
  ],
  chill: [
    "Calm vibes tonight. Good for conversation, not for turn-up. Know what you're going for before you pull up.",
    "Low energy right now. The crowd is light but relaxed — ideal for a mellow night out, not a rave.",
    "The scene dey move slow tonight. If you're looking for something chill and laid back, this could work.",
  ],
  quiet: [
    "Not much happening here right now. Might pick up later but no guarantees tonight.",
    "The place is quiet. Could be the calm before something or just a slow night — risky move.",
    "Tonight isn't the night for this venue. Your energy is better used elsewhere.",
  ],
};

function getDemoComment(energyLevel: string, venueId: string): string {
  const pool = DEMO_COMMENTS[energyLevel] ?? DEMO_COMMENTS['quiet'];
  const idx = venueId.charCodeAt(0) % pool.length;
  return pool[idx];
}

interface Props {
  venueId: string;
  venueName: string;
  energyLevel: string;
  vibeScore: number;
  isDemoMode?: boolean;
  capacityLevel?: string;
}

export default function AIPulseComment({ venueId, venueName, energyLevel, vibeScore, isDemoMode, capacityLevel }: Props) {
  const [comment, setComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isAI, setIsAI] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const dotAnim   = useRef(new Animated.Value(0.4)).current;

  // Typing dot pulse while loading
  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [loading]);

  // Fade in when comment arrives
  useEffect(() => {
    if (!comment) return;
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [comment]);

  useEffect(() => {
    loadComment();
  }, [venueId, energyLevel]);

  const loadComment = async () => {
    if (isDemoMode) {
      setComment(getDemoComment(energyLevel, venueId));
      setIsAI(false);
      return;
    }
    setLoading(true);
    fadeAnim.setValue(0);
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/ai-pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_name: venueName,
          energy_level: energyLevel,
          vibe_score: vibeScore,
          capacity_level: capacityLevel ?? 'vibrant',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setComment(data.comment ?? getDemoComment(energyLevel, venueId));
        setIsAI(data.ai_powered ?? false);
      } else {
        setComment(getDemoComment(energyLevel, venueId));
        setIsAI(false);
      }
    } catch {
      setComment(getDemoComment(energyLevel, venueId));
      setIsAI(false);
    }
    setLoading(false);
  };

  const ENERGY_COLORS: Record<string, string> = {
    peak: '#FF3366', lit: '#FF8C00', charged: '#9933FF',
    warming: '#6655FF', chill: '#3399FF', quiet: '#3A3A4E',
  };
  const color = ENERGY_COLORS[energyLevel] ?? '#6655FF';

  return (
    <LinearGradient
      colors={[color + '12', color + '06', 'transparent']}
      style={[styles.container, { borderColor: color + '22' }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.labelRow}>
          {isAI ? (
            <Ionicons name="sparkles" size={11} color={color} />
          ) : (
            <Animated.View style={[styles.liveDot, { backgroundColor: color, opacity: loading ? dotAnim : 1 }]} />
          )}
          <Text style={[styles.label, { color }]}>
            {isAI ? 'AI SCENE INTEL' : 'LIVE READ'}
          </Text>
        </View>
        <TouchableOpacity onPress={loadComment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Ionicons name="refresh" size={13} color={color + '88'} />
        </TouchableOpacity>
      </View>

      {/* Comment */}
      {loading ? (
        <View style={styles.loadingRow}>
          <Animated.View style={[styles.loadingDot, { backgroundColor: color, opacity: dotAnim }]} />
          <Animated.View style={[styles.loadingDot, { backgroundColor: color, opacity: dotAnim, marginLeft: 4 }]} />
          <Animated.View style={[styles.loadingDot, { backgroundColor: color, opacity: dotAnim, marginLeft: 4 }]} />
          <Text style={styles.loadingText}>Reading the scene...</Text>
        </View>
      ) : comment ? (
        <Animated.Text
          style={[styles.comment, { opacity: fadeAnim }]}
          numberOfLines={expanded ? undefined : 2}
          onPress={() => setExpanded(e => !e)}
        >
          {comment}
        </Animated.Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  labelRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label:      { fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  liveDot:    { width: 6, height: 6, borderRadius: 3 },
  comment:    { fontSize: 13, color: '#AAA', fontWeight: '500', lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  loadingDot: { width: 5, height: 5, borderRadius: 2.5 },
  loadingText:{ fontSize: 11, color: '#444', marginLeft: 8, fontWeight: '500' },
});
