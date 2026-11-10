/**
 * Taking a reading. Three questions in the order a scout answers them:
 * how alive it is (a thermal scale, hottest on top), how full, and the door.
 * Replaces the emoji-grid RateVibeModal (design spec, Nov 2026). Submits the
 * same payload, so the server is unchanged. CHARGED is not a choice: it is
 * derived from the score and a full room.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button } from './ui';
import { color, energy, EnergyState, radius, sheet, sheetHandle, space, type } from '../theme/tokens';

type Energy = 'peak' | 'lit' | 'warming' | 'chill' | 'quiet';
type Capacity = 'sparse' | 'vibrant' | 'full';
type Gate = 'clear' | 'slow' | 'blocked';

export type ReadingData = { energy: Energy; capacity: Capacity; gate: Gate; staked?: boolean };

const SCALE: Energy[] = ['peak', 'lit', 'warming', 'chill', 'quiet'];
const CAPACITY: { key: Capacity; label: string }[] = [
  { key: 'sparse', label: 'Sparse' }, { key: 'vibrant', label: 'Filling up' }, { key: 'full', label: 'Packed' },
];
const GATE: { key: Gate; label: string }[] = [
  { key: 'clear', label: 'Walk in' }, { key: 'slow', label: 'Slow' }, { key: 'blocked', label: 'Jammed' },
];

interface Props {
  visible: boolean;
  venueName: string;
  onClose: () => void;
  onSubmit: (d: ReadingData) => Promise<void>;
  cooldownSeconds?: number;
  callsRemaining?: number;
  isDemo?: boolean;
}

function Segmented<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]; value: T | null; onChange: (v: T) => void;
}) {
  return (
    <View style={s.segment} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(o.key); }}
            style={[s.segItem, on && s.segOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
            <Text style={[s.segText, on && s.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ReadingSheet({ visible, venueName, onClose, onSubmit, cooldownSeconds = 0, callsRemaining = 0, isDemo }: Props) {
  const insets = useSafeAreaInsets();
  const [e, setE] = useState<Energy | null>(null);
  const [c, setC] = useState<Capacity | null>(null);
  const [g, setG] = useState<Gate | null>(null);
  const [staked, setStaked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setE(null); setC(null); setG(null); setStaked(false); setError(null); }
  }, [visible]);

  const waitMin = Math.ceil(cooldownSeconds / 60);
  const send = async () => {
    if (!e) return;
    setSending(true); setError(null);
    try {
      await onSubmit({ energy: e, capacity: c ?? 'vibrant', gate: g ?? 'clear', staked });
    } catch (err: any) {
      setError(err?.message || 'That reading did not go through. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[sheet, s.sheet, { paddingBottom: insets.bottom + space.md }]}>
        <View style={sheetHandle} />
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <Text style={s.kicker}>{isDemo ? 'Demo reading' : 'Reading'} at {venueName}</Text>

          <Text style={s.q}>How alive is it?</Text>
          {SCALE.map((k) => {
            const on = e === k;
            const look = energy[k as EnergyState];
            return (
              <Pressable key={k} onPress={() => { Haptics.selectionAsync().catch(() => {}); setE(k); }}
                style={[s.scaleRow, on && { backgroundColor: look.fill + '3D', borderColor: look.ink }]}
                accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={look.label}>
                <Text style={[s.scaleWord, on && { color: look.ink }]}>{look.label}</Text>
                <View style={[s.scaleDot, { backgroundColor: look.fill }, k === 'quiet' && s.quietDot]} />
              </Pressable>
            );
          })}

          <Text style={s.q}>How full?</Text>
          <Segmented options={CAPACITY} value={c} onChange={setC} />

          <Text style={s.q}>The door?</Text>
          <Segmented options={GATE} value={g} onChange={setG} />

          {callsRemaining > 0 && !isDemo && (
            <View style={s.callRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.callTitle}>Make it a Call</Text>
                <Text style={s.caption}>Stake your reputation on this one. {callsRemaining} left tonight.</Text>
              </View>
              <Switch value={staked} onValueChange={setStaked}
                trackColor={{ true: color.accentPressed, false: color.raised }} thumbColor={color.ink} />
            </View>
          )}

          {!!error && <Text style={s.error}>{error}</Text>}

          <Button label={sending ? 'Sending' : waitMin > 0 ? `You can read again in ${waitMin} min` : 'Send reading'}
            onPress={send} disabled={!e || sending || waitMin > 0} style={{ marginTop: space.lg }} />
          {sending && <ActivityIndicator color={color.inkSoft} style={{ marginTop: space.xs }} />}
          <Text style={[s.caption, s.center]}>Readings fade over three hours, so the map always shows tonight.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%' },
  body: { paddingHorizontal: space.md, paddingBottom: space.md },
  kicker: { ...type.label, color: color.inkSoft, marginTop: space.xs },
  q: { ...type.title, color: color.ink, marginTop: space.lg, marginBottom: space.sm },
  scaleRow: {
    height: 56, borderRadius: radius.pill, backgroundColor: color.raised, borderWidth: 1.5, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg,
    marginBottom: space.xs,
  },
  scaleWord: { ...type.bodyStrong, color: color.ink },
  scaleDot: { width: 12, height: 12, borderRadius: 6 },
  quietDot: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: color.inkFaint },
  segment: { flexDirection: 'row', backgroundColor: color.raised, borderRadius: radius.pill, padding: 4, gap: 4 },
  segItem: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.accent },
  segText: { ...type.labelStrong, color: color.inkSoft },
  segTextOn: { color: color.inkOnAccent },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  callTitle: { ...type.bodyStrong, color: color.ink },
  caption: { ...type.caption, color: color.inkSoft, marginTop: space.xxs },
  center: { textAlign: 'center', marginTop: space.sm },
  error: { ...type.label, color: color.danger, marginTop: space.md },
});
