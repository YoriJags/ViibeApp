/**
 * PromptCadencePicker — how often VIIBE asks, once it knows you are in a room.
 *
 * The staleness problem was never that people refuse to refresh a reading. It
 * is that nobody remembers to. Asking someone to remember is asking them to do
 * work, and this must never feel like work. So the app asks, on a rhythm the
 * scout picks once and then never thinks about again.
 *
 * "Off" is a real option, not a dark pattern. An app that nags gets its
 * notifications turned off, and then it cannot reach anyone at all.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CADENCE_CACHE_KEY } from '../services/autoPresence';
import { card, color, radius, space, type } from '../theme/tokens';

// The arrival prompt is scheduled by a background task that cannot wait on the
// network, so it reads this local copy of the cadence. Kept in step on load
// and on every successful save, so "off" really does stop the arrival prompt.
const cacheCadence = (c: string | null) => {
  if (!c) return;
  AsyncStorage.setItem(CADENCE_CACHE_KEY, c).catch(() => {});
};

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Option {
  key: string;
  label: string;
  sub: string;
  minutes: number | null;
}

interface Props {
  getAuthHeaders: () => Record<string, string>;
  accent?: string;
}

export default function PromptCadencePicker({ getAuthHeaders, accent = color.ink }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [cadence, setCadence] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/me/prompt-cadence`, { headers: getAuthHeaders() });
        if (!r.ok) throw new Error('unavailable');
        const d = await r.json();
        if (cancelled) return;
        setOptions(d.options ?? []);
        setCadence(d.cadence ?? null);
        cacheCadence(d.cadence ?? null);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const choose = async (key: string) => {
    if (key === cadence || saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const previous = cadence;
    setCadence(key);      // optimistic, it is a preference not a transaction
    setSaving(key);
    try {
      const r = await fetch(`${API_URL}/api/me/prompt-cadence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ cadence: key }),
      });
      if (!r.ok) throw new Error('save failed');
      cacheCadence(key);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setCadence(previous);   // never pretend a setting saved when it did not
      setFailed(true);
    } finally {
      setSaving(null);
    }
  };

  if (failed && !options.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>How often should we ask?</Text>
        <Text style={styles.errorText}>
          Cannot reach your settings right now. Nothing has changed.
        </Text>
      </View>
    );
  }

  if (!options.length) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator size="small" color={accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How often should we ask?</Text>
      <Text style={styles.subtitle}>
        Only while you are actually inside a venue. Never more than six times a night.
      </Text>

      {options.map((o) => {
        const active = o.key === cadence;
        return (
          <TouchableOpacity
            key={o.key}
            activeOpacity={0.85}
            onPress={() => choose(o.key)}
            style={[styles.row, active && { borderColor: color.lineStrong, backgroundColor: color.raised }]}
          >
            <View style={[styles.radio, active && { borderColor: color.ink, backgroundColor: color.ink }]}>
              {active && <Ionicons name="checkmark" size={12} color="#0b0b14" />}
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.label}>{o.label}</Text>
              <Text style={styles.description}>{o.sub}</Text>
            </View>
            {saving === o.key && <ActivityIndicator size="small" color={accent} />}
          </TouchableOpacity>
        );
      })}

      {failed && (
        <Text style={styles.errorText}>That did not save. Your previous choice is still set.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...card, gap: space.xs },
  loading: { alignItems: 'center', paddingVertical: space.lg },
  title: { ...type.bodyStrong, color: color.ink },
  subtitle: { ...type.label, color: color.inkSoft, marginBottom: space.xxs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56,
    paddingHorizontal: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent',
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: color.inkFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  label: { ...type.bodyStrong, color: color.ink },
  description: { ...type.caption, color: color.inkSoft, marginTop: 2 },
  errorText: { ...type.label, color: color.danger, marginTop: space.xxs },
});
