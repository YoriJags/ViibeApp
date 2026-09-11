/**
 * PulseCheckCard — the one-tap refresh that stops the reading going stale.
 *
 * A full vibe check is three questions, which is right once per visit and far
 * too much to repeat every fifteen minutes. Without repetition the map quietly
 * starts lying, because energy decays in minutes.
 *
 * So when a scout is still in the room and their reading is about to expire,
 * they are asked one thing instead of three. The card carries the consequence
 * ("41 people are watching this room") because two seconds of effort feels
 * like influence when it visibly matters, and like data entry when it does not.
 *
 * It appears only when the reading is genuinely expiring and the person is
 * confirmed present, so it stays rare and always relevant.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getBoltCoordinates } from '../utils/boltLocation';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Matched to the venue screen this card sits on (glassy cards, gold labels,
// the app's orange accent) rather than the thermal palette used on the
// marketing site. A lone warm-brown card in a midnight-blue app reads as a
// bug, however good it looks in isolation.
const UI = {
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  btnBg: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.5)',
  gold: '#C9A84C',
  accent: '#FF6B35',
  onAccent: '#1A1A2E',
};

/** Ask only once the reading is close to expiring (readings die at 15 min). */
export const PROMPT_AFTER_MINUTES = 10;

type Delta = 'same' | 'hotter' | 'cooling';

interface Props {
  venueId: string;
  energyLevel?: string | null;
  lastRatedMinsAgo?: number | null;
  watchersNow?: number | null;
  isInsideVenue: boolean;
  onRefreshed?: (result: any) => void;
}

export default function PulseCheckCard({
  venueId, energyLevel, lastRatedMinsAgo, watchersNow, isInsideVenue, onRefreshed,
}: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [busy, setBusy] = useState<Delta | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = lastRatedMinsAgo != null && lastRatedMinsAgo >= PROMPT_AFTER_MINUTES;
  if (!isInsideVenue || !stale || done) return null;

  const submit = async (delta: Delta) => {
    setBusy(delta);
    setError(null);
    try {
      const coordinates = await getBoltCoordinates();
      const res = await fetch(`${API_URL}/api/venues/${venueId}/pulse-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ delta, coordinates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.detail || 'Could not send that. Try again.');
        setBusy(null);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const data = await res.json();
      setDone(true);
      onRefreshed?.(data);
    } catch {
      setError('No connection. Try again.');
    }
    setBusy(null);
  };

  const reads = (energyLevel || 'quiet').toUpperCase();
  const watching = watchersNow ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="hourglass-outline" size={14} color={UI.gold} />
        <Text style={styles.head}>THIS READING IS GOING STALE</Text>
      </View>

      <Text style={styles.question}>
        Still <Text style={styles.reads}>{reads}</Text> in here?
      </Text>

      <View style={styles.row}>
        {(['cooling', 'same', 'hotter'] as Delta[]).map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.btn, d === 'same' && styles.btnSame]}
            onPress={() => submit(d)}
            disabled={busy !== null}
            activeOpacity={0.8}
          >
            {busy === d
              ? <ActivityIndicator size="small" color={UI.onAccent} />
              : <Text style={[styles.btnText, d === 'same' && styles.btnTextSame]}>
                  {d === 'cooling' ? 'Cooling' : d === 'same' ? 'Same' : 'Hotter'}
                </Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* The reason it is worth two seconds */}
      <Text style={styles.why}>
        {watching > 0
          ? `${watching} ${watching === 1 ? 'person is' : 'people are'} watching this room right now. Yours is the freshest read.`
          : 'Yours is the freshest read on this room.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: UI.cardBg,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  head: { color: UI.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  question: { color: UI.text, fontSize: 19, fontWeight: '700', marginBottom: 14 },
  reads: { color: UI.accent },
  row: { flexDirection: 'row', gap: 9 },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: UI.cardBorder, backgroundColor: UI.btnBg,
  },
  btnSame: { backgroundColor: UI.accent, borderColor: UI.accent },
  btnText: { color: UI.text, fontSize: 14, fontWeight: '700' },
  btnTextSame: { color: UI.onAccent },
  why: { color: UI.muted, fontSize: 11, marginTop: 11, lineHeight: 16 },
  error: { color: UI.accent, fontSize: 11, marginTop: 8 },
});
