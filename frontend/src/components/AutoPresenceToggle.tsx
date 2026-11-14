/**
 * AutoPresenceToggle — the opt-in for automatic check-in.
 *
 * Background location is the most sensitive permission this app asks for, so
 * the explanation comes first, on our own screen, in plain words, and the
 * operating system prompt only appears after the person chooses to continue.
 * Every promise made here is enforced in code: see services/autoPresence.ts and
 * backend/app/services/presence.py.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  disableAutoPresence,
  enableAutoPresence,
  isAutoPresenceEnabled,
  syncWatchedVenues,
} from '../services/autoPresence';
import { useVibeStore } from '../store/vibeStore';

const PROMISES = [
  'Only arriving at and leaving venues on the map. Never where you go in between.',
  'Your name is never shown. You count towards how many people are there, nothing more.',
  'It earns no clout. Clout comes from readings you choose to give.',
  'Switch it off here, any time, and it stops straight away.',
];

interface Props {
  accent?: string;
}

export default function AutoPresenceToggle({ accent = '#22d3ee' }: Props) {
  const venues = useVibeStore((s) => s.venues);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsSettings, setNeedsSettings] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    isAutoPresenceEnabled().then(setEnabled);
  }, []);

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setNeedsSettings(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!next) {
      await disableAutoPresence();
      setEnabled(false);
      setBusy(false);
      return;
    }

    const result = await enableAutoPresence();
    if (result.ok) {
      setEnabled(true);
      await syncWatchedVenues(venues as any[]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setEnabled(false);
      if (result.reason === 'background') {
        setNeedsSettings(true);
        setProblem('Your phone needs location set to "Allow all the time" for this to work.');
      } else if (result.reason === 'foreground') {
        setProblem('Location permission was declined, so auto check-in stays off.');
      } else {
        setProblem('Something went wrong switching this on. Nothing has changed.');
      }
    }
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Auto check-in</Text>
          <Text style={styles.subtitle}>
            When you walk into a venue on the map, your phone checks you in and out on its own,
            so VIIBE can count the room and ask how it feels at the right moment.
          </Text>
        </View>
        {enabled === null || busy ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={toggle}
            trackColor={{ false: '#333', true: accent + '66' }}
            thumbColor={enabled ? accent : '#777'}
          />
        )}
      </View>

      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p} style={styles.promiseRow}>
            <Text style={[styles.dot, { color: accent }]}>{'●'}</Text>
            <Text style={styles.promiseText}>{p}</Text>
          </View>
        ))}
      </View>

      {problem && <Text style={styles.problem}>{problem}</Text>}
      {needsSettings && (
        <TouchableOpacity onPress={() => Linking.openSettings()} style={[styles.settingsBtn, { borderColor: accent }]}>
          <Text style={[styles.settingsText, { color: accent }]}>Open settings</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.9)' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 17 },
  promises: { gap: 6 },
  promiseRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { fontSize: 7, marginTop: 5 },
  promiseText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  problem: { fontSize: 12, color: '#ff8a8a', lineHeight: 17 },
  settingsBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  settingsText: { fontSize: 13, fontWeight: '700' },
});
