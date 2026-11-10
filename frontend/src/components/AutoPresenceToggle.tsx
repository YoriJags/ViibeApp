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
import { card, color, radius, space, type } from '../theme/tokens';

const PROMISES = [
  'Only arriving at and leaving venues on the map. Never where you go in between.',
  'Your name is never shown. You count towards how many people are there, nothing more.',
  'It earns no clout. Clout comes from readings you choose to give.',
  'Switch it off here, any time, and it stops straight away.',
];

interface Props {
  accent?: string;
}

export default function AutoPresenceToggle({ accent = color.ink }: Props) {
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
            trackColor={{ false: color.raised, true: color.accentPressed }}
            thumbColor={color.ink}
          />
        )}
      </View>

      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p} style={styles.promiseRow}>
            <View style={styles.dot} />
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
  container: { ...card, gap: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { ...type.bodyStrong, color: color.ink },
  subtitle: { ...type.label, color: color.inkSoft, marginTop: space.xxs },
  promises: { gap: space.xs },
  promiseRow: { flexDirection: 'row', gap: space.xs, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.inkFaint, marginTop: 7 },
  promiseText: { ...type.label, color: color.inkSoft, flex: 1 },
  problem: { ...type.label, color: color.danger },
  settingsBtn: {
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center',
    paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.lineStrong,
  },
  settingsText: { ...type.labelStrong, color: color.ink },
});
