/**
 * Building blocks for the Add an event / Add a place screens, in the
 * Editorial Night style (src/theme/editorial.ts).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ed, edType, edSpace, edRadius } from '../../theme/editorial';
import { PlaceResult, PLACE_TYPE_LABELS, searchPlaces } from '../../services/submissions';

// ── Layout ──────────────────────────────────────────────────────────────────

export function ScreenHeader({ kicker, title, onBack, right }: {
  kicker?: string; title: string; onBack?: () => void; right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 8 }]}>
      <View style={s.headerRow}>
        <TouchableOpacity
          onPress={onBack || (() => router.back())}
          style={s.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={ed.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {kicker ? <Text style={[edType.kicker, { marginTop: 14 }]}>{kicker}</Text> : null}
      <Text style={[edType.headline, { marginTop: 4 }]}>{title}</Text>
    </View>
  );
}

export function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.stepBar}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.stepSeg, i <= step && { backgroundColor: ed.pink }]} />
      ))}
    </View>
  );
}

export function SectionLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ marginTop: edSpace.lg, marginBottom: edSpace.sm }}>
      <Text style={edType.kicker}>{children.toUpperCase()}</Text>
      {hint ? <Text style={[edType.caption, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Footer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>{children}</View>;
}

// ── Controls ────────────────────────────────────────────────────────────────

export function PrimaryButton({ label, onPress, disabled, busy }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean;
}) {
  const off = disabled || busy;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      style={[s.primary, off && { opacity: 0.4 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
    >
      {busy ? <ActivityIndicator color={ed.ink} /> : <Text style={s.primaryText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function GhostButton({ label, icon, onPress }: {
  label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={s.ghost} activeOpacity={0.8} accessibilityRole="button">
      {icon ? <Ionicons name={icon} size={18} color={ed.ink} /> : null}
      <Text style={edType.label}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.chip, selected && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[edType.label, { color: selected ? ed.bg : ed.ink }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChoiceCard({ title, body, selected, onPress, icon }: {
  title: string; body: string; selected?: boolean; onPress: () => void; icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.choice, selected && { borderColor: ed.pink, backgroundColor: ed.pinkSoft }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      <Ionicons name={icon} size={20} color={selected ? ed.pink : ed.inkSoft} />
      <View style={{ flex: 1 }}>
        <Text style={edType.bodyStrong}>{title}</Text>
        <Text style={[edType.caption, { marginTop: 2 }]}>{body}</Text>
      </View>
      <View style={[s.radio, selected && { borderColor: ed.pink }]}>
        {selected ? <View style={s.radioDot} /> : null}
      </View>
    </TouchableOpacity>
  );
}

export function Field({ value, onChangeText, placeholder, maxLength, autoCapitalize, keyboardType, autoFocus }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; maxLength?: number;
  autoCapitalize?: 'none' | 'words' | 'sentences'; keyboardType?: 'default' | 'url'; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={ed.inkFaint}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      autoCorrect={false}
      autoFocus={autoFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[s.field, focused && { borderColor: ed.lineStrong }]}
    />
  );
}

export function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={s.problems} accessibilityLiveRegion="polite">
      {items.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Ionicons name="alert-circle-outline" size={16} color={ed.danger} style={{ marginTop: 2 }} />
          <Text style={[edType.body, { color: ed.ink, flex: 1 }]}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Where ───────────────────────────────────────────────────────────────────

export function PlaceCard({ place, onClear }: { place: PlaceResult; onClear?: () => void }) {
  const tag = place.source === 'viibe' ? 'On VIIBE' : place.source === 'here' ? 'Your location' : 'OpenStreetMap';
  return (
    <View style={s.placeCard}>
      <View style={s.placeIcon}>
        <Ionicons name={place.source === 'here' ? 'navigate' : 'location'} size={20} color={ed.pink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={edType.bodyStrong} numberOfLines={1}>{place.name}</Text>
        <Text style={[edType.caption, { marginTop: 2 }]} numberOfLines={2}>
          {[place.place_type ? PLACE_TYPE_LABELS[place.place_type] : null, place.area || place.address]
            .filter(Boolean).join(' · ')}
        </Text>
        <Text style={[edType.caption, { marginTop: 6, color: place.source === 'viibe' ? ed.success : ed.gold }]}>
          {tag}{place.source === 'viibe' ? ', location already checked' : ', we check the pin before it goes live'}
        </Text>
      </View>
      {onClear ? (
        <TouchableOpacity onPress={onClear} style={s.iconBtn} accessibilityLabel="Change place">
          <Ionicons name="close" size={20} color={ed.inkSoft} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Search VIIBE's places and OpenStreetMap, or use where the person is
 * standing. The chosen spot is never trusted on its own: an admin checks it
 * before the event appears on the map.
 */
export function PlacePicker({ city, onPick, allowHere = true }: {
  city: string; onPick: (p: PlaceResult) => void; allowHere?: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); setError(null); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchPlaces(query, city);
        if (mine === seq.current) { setResults(r); setError(null); }
      } catch {
        if (mine === seq.current) setError('Search is not answering. Try again, or use where you are standing.');
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, city]);

  const useHere = async () => {
    setLocating(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location is off for VIIBE. Search for the place instead, or allow location in Settings.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const acc = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
      onPick({
        source: 'here',
        name: 'Where I am standing',
        address: acc ? `Accurate to about ${acc} m` : undefined,
        coordinates: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      });
    } catch {
      setError('Could not get your location. Try again outside, or search for the place.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color={ed.inkFaint} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search a place, e.g. National Theatre"
          placeholderTextColor={ed.inkFaint}
          style={s.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading ? <ActivityIndicator size="small" color={ed.inkSoft} /> : null}
      </View>

      {error ? <Text style={[edType.caption, { color: ed.danger, marginTop: 8 }]}>{error}</Text> : null}

      {results.map((r) => (
        <TouchableOpacity
          key={r.id || r.osm_id || r.name}
          onPress={() => onPick(r)}
          style={s.resultRow}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="location-outline" size={18} color={r.source === 'viibe' ? ed.pink : ed.inkSoft} />
          <View style={{ flex: 1 }}>
            <Text style={edType.bodyStrong} numberOfLines={1}>{r.name}</Text>
            <Text style={edType.caption} numberOfLines={1}>{r.area || r.address}</Text>
          </View>
          {r.source === 'viibe' ? <Text style={[edType.caption, { color: ed.success }]}>On VIIBE</Text> : null}
        </TouchableOpacity>
      ))}

      {q.trim().length >= 2 && !loading && !error && results.length === 0 ? (
        <Text style={[edType.caption, { marginTop: 10 }]}>
          Nothing by that name in {city === 'abuja' ? 'Abuja' : 'Lagos'}. Try a shorter name, or use where you are standing.
        </Text>
      ) : null}

      {allowHere ? (
        <View style={{ marginTop: edSpace.md }}>
          <GhostButton
            label={locating ? 'Finding you...' : 'Use where I am standing'}
            icon="navigate-outline"
            onPress={useHere}
          />
          <Text style={[edType.caption, { marginTop: 6 }]}>
            Best for raves, block parties and open grounds with no name on the map.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── When ────────────────────────────────────────────────────────────────────
// Lagos is UTC+1 all year, so wall-clock times are built with a fixed offset.

const LAGOS_MS = 3600_000;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The Lagos calendar date of an instant, as a Date whose UTC fields are Lagos wall time. */
const lagosWall = (ms: number) => new Date(ms + LAGOS_MS);

export function lagosIso(ms: number): string {
  const w = lagosWall(ms);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:00+01:00`;
}

export function formatLagos(ms: number, withDay = true): string {
  const w = lagosWall(ms);
  const h = w.getUTCHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${pad(w.getUTCMinutes())}${h < 12 ? 'am' : 'pm'}`;
  if (!withDay) return time;
  return `${DAY_NAMES[w.getUTCDay()]} ${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]}, ${time}`;
}

const DURATIONS: { label: string; hours: number }[] = [
  { label: '3 hrs', hours: 3 },
  { label: '4 hrs', hours: 4 },
  { label: '6 hrs', hours: 6 },
  { label: '8 hrs', hours: 8 },
  { label: '12 hrs', hours: 12 },
  { label: '1 day', hours: 24 },
  { label: '2 days', hours: 48 },
  { label: '3 days', hours: 72 },
];

export interface WhenValue { startMs: number; hours: number }

export function WhenPicker({ value, onChange }: { value: WhenValue | null; onChange: (v: WhenValue) => void }) {
  // Days: today and the next 59, starting from Lagos midnight.
  const days = useMemo(() => {
    const w = lagosWall(Date.now());
    const midnight = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - LAGOS_MS;
    return Array.from({ length: 60 }, (_, i) => midnight + i * 86400_000);
  }, []);
  const slots = useMemo(() => Array.from({ length: 48 }, (_, i) => i * 30), []); // minutes after midnight

  const dayMs = value ? days.find((d) => value.startMs >= d && value.startMs < d + 86400_000) ?? days[0] : null;
  const minute = value && dayMs != null ? Math.round((value.startMs - dayMs) / 60000) : null;
  const hours = value?.hours ?? 6;

  const set = (d: number | null, m: number | null, h: number) => {
    const day = d ?? days[0];
    const min = m ?? 20 * 60;
    onChange({ startMs: day + min * 60000, hours: h });
  };

  const now = Date.now();
  const timeRef = useRef<ScrollView>(null);
  useEffect(() => {
    // Open the time row around the evening, where most events start.
    const t = setTimeout(() => timeRef.current?.scrollTo({ x: 34 * 74, animated: false }), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <View>
      <SectionLabel>Day</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d, i) => {
          const w = lagosWall(d);
          const on = dayMs === d;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => set(d, minute, hours)}
              style={[s.day, on && s.dayOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[edType.caption, { color: on ? ed.bg : ed.inkFaint }]}>
                {i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAY_NAMES[w.getUTCDay()]}
              </Text>
              <Text style={[s.dayNum, { color: on ? ed.bg : ed.ink }]}>{w.getUTCDate()}</Text>
              <Text style={[edType.caption, { color: on ? ed.bg : ed.inkFaint }]}>{MONTHS[w.getUTCMonth()]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <SectionLabel>Doors open</SectionLabel>
      <ScrollView ref={timeRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {slots.map((m) => {
          const at = (dayMs ?? days[0]) + m * 60000;
          const past = at < now - 30 * 60000;
          const on = minute === m;
          return (
            <TouchableOpacity
              key={m}
              disabled={past}
              onPress={() => set(dayMs, m, hours)}
              style={[s.time, on && s.chipOn, past && { opacity: 0.3 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: past }}
            >
              <Text style={[edType.label, { color: on ? ed.bg : ed.ink }]}>{formatLagos(at, false)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <SectionLabel>How long it runs</SectionLabel>
      <View style={s.wrap}>
        {DURATIONS.map((d) => (
          <Chip key={d.hours} label={d.label} selected={hours === d.hours && !!value}
            onPress={() => set(dayMs, minute, d.hours)} />
        ))}
      </View>

      {value ? (
        <View style={s.whenSummary}>
          <Text style={edType.caption}>STARTS</Text>
          <Text style={[edType.bodyStrong, { marginBottom: 8 }]}>{formatLagos(value.startMs)}</Text>
          <Text style={edType.caption}>ENDS</Text>
          <Text style={edType.bodyStrong}>{formatLagos(value.startMs + value.hours * 3600_000)}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Make it yours ───────────────────────────────────────────────────────────

/** Type a name, tap Add (or the return key), and it becomes a removable chip. */
export function TagInput({ values, onChange, placeholder, max, maxLength, suggestions }: {
  values: string[]; onChange: (v: string[]) => void; placeholder: string;
  max: number; maxLength: number; suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || values.length >= max) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([...values, v.slice(0, maxLength)]);
    setDraft('');
  };
  const full = values.length >= max;
  return (
    <View>
      {values.length ? (
        <View style={[s.wrap, { marginBottom: 10 }]}>
          {values.map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => onChange(values.filter((x) => x !== v))}
              style={s.tag}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${v}`}
            >
              <Text style={edType.label}>{v}</Text>
              <Ionicons name="close" size={14} color={ed.inkSoft} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {full ? (
        <Text style={edType.caption}>That is the most you can add. Tap one to remove it.</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => add(draft)}
              blurOnSubmit={false}
              placeholder={placeholder}
              placeholderTextColor={ed.inkFaint}
              maxLength={maxLength}
              autoCorrect={false}
              returnKeyType="done"
              style={s.field}
            />
          </View>
          <TouchableOpacity
            onPress={() => add(draft)}
            disabled={!draft.trim()}
            style={[s.addBtn, !draft.trim() && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Add"
          >
            <Ionicons name="add" size={22} color={ed.ink} />
          </TouchableOpacity>
        </View>
      )}
      {suggestions && !full ? (
        <View style={[s.wrap, { marginTop: 10 }]}>
          {suggestions.filter((g) => !values.includes(g)).map((g) => (
            <TouchableOpacity key={g} onPress={() => add(g)} style={s.suggest} accessibilityRole="button">
              <Text style={[edType.caption, { color: ed.inkSoft }]}>+ {g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Pick a cover photo from the library, cropped wide and resized so it uploads
 * quickly and stays under the server's limit. Gives back JPEG base64.
 */
export function CoverPicker({ value, onChange }: { value: string | null; onChange: (b64: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    setError(null);
    setBusy(true);
    try {
      const ImagePicker = await import('expo-image-picker');
      const ImageManipulator = await import('expo-image-manipulator');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const small = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!small.base64) { setError('Could not read that photo. Try another.'); return; }
      if (small.base64.length > 790_000) { setError('That photo is too large. Try another.'); return; }
      onChange(small.base64);
    } catch {
      setError('Could not open your photos. Check that VIIBE may use them in Settings.');
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <View>
        <Image source={{ uri: `data:image/jpeg;base64,${value}` }} style={s.cover} resizeMode="cover" />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          <Text style={[edType.label, { color: ed.pink }]} onPress={pick} accessibilityRole="button">Change photo</Text>
          <Text style={[edType.label, { color: ed.inkSoft }]} onPress={() => onChange(null)} accessibilityRole="button">Remove</Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <TouchableOpacity onPress={pick} style={s.coverEmpty} activeOpacity={0.85} accessibilityRole="button">
        {busy ? <ActivityIndicator color={ed.inkSoft} /> : (
          <>
            <Ionicons name="image-outline" size={28} color={ed.inkSoft} />
            <Text style={[edType.label, { marginTop: 8 }]}>Add a cover photo</Text>
            <Text style={[edType.caption, { marginTop: 2 }]}>Your flyer or a shot of the venue</Text>
          </>
        )}
      </TouchableOpacity>
      {error ? <Text style={[edType.caption, { color: ed.danger, marginTop: 6 }]}>{error}</Text> : null}
    </View>
  );
}

/** Multi-line field for the description. */
export function TextArea({ value, onChangeText, placeholder, maxLength }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; maxLength: number;
}) {
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ed.inkFaint}
        maxLength={maxLength}
        multiline
        textAlignVertical="top"
        style={[s.field, { height: 120, paddingTop: 14 }]}
      />
      <Text style={[edType.caption, { textAlign: 'right', marginTop: 4 }]}>{value.length}/{maxLength}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { paddingHorizontal: edSpace.gutter, paddingBottom: edSpace.md, backgroundColor: ed.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: edSpace.gutter, marginBottom: 4 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: ed.raised },
  footer: {
    paddingHorizontal: edSpace.gutter, paddingTop: 12, backgroundColor: ed.bg,
    borderTopWidth: 1, borderTopColor: ed.line,
  },
  primary: {
    height: 52, borderRadius: edRadius.pill, backgroundColor: ed.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  ghost: {
    height: 48, borderRadius: edRadius.pill, borderWidth: 1, borderColor: ed.lineStrong,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 16, height: 40, borderRadius: edRadius.pill, backgroundColor: ed.raised,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ed.line,
  },
  chipOn: { backgroundColor: ed.ink, borderColor: ed.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: edRadius.md,
    backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line, marginBottom: 10,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ed.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ed.pink },
  field: {
    height: 52, borderRadius: edRadius.sm, backgroundColor: ed.surface, borderWidth: 1,
    borderColor: ed.line, paddingHorizontal: 16, fontSize: 16, color: ed.ink,
  },
  problems: {
    marginTop: edSpace.md, padding: 14, borderRadius: edRadius.sm, gap: 8,
    backgroundColor: 'rgba(255,122,107,0.10)', borderWidth: 1, borderColor: 'rgba(255,122,107,0.35)',
  },
  placeCard: {
    flexDirection: 'row', gap: 14, padding: 16, borderRadius: edRadius.md,
    backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line, alignItems: 'flex-start',
  },
  placeIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: ed.pinkSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16,
    borderRadius: edRadius.pill, backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
  searchInput: { flex: 1, fontSize: 16, color: ed.ink, height: 52 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: ed.line,
  },
  day: {
    width: 64, paddingVertical: 10, borderRadius: edRadius.md, backgroundColor: ed.surface,
    borderWidth: 1, borderColor: ed.line, alignItems: 'center',
  },
  dayOn: { backgroundColor: ed.ink, borderColor: ed.ink },
  dayNum: { fontSize: 22, lineHeight: 26, fontWeight: '700', marginVertical: 2 },
  time: {
    width: 66, height: 40, borderRadius: edRadius.pill, backgroundColor: ed.raised,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ed.line,
  },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 10, height: 36,
    borderRadius: edRadius.pill, backgroundColor: ed.raised, borderWidth: 1, borderColor: ed.lineStrong,
  },
  suggest: {
    paddingHorizontal: 12, height: 32, borderRadius: edRadius.pill, borderWidth: 1, borderColor: ed.line,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    width: 52, height: 52, borderRadius: edRadius.sm, backgroundColor: ed.raised,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ed.line,
  },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: edRadius.md, backgroundColor: ed.surface },
  coverEmpty: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: edRadius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: ed.lineStrong, backgroundColor: ed.surface, alignItems: 'center', justifyContent: 'center',
  },
  whenSummary: {
    marginTop: edSpace.lg, padding: 16, borderRadius: edRadius.md,
    backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
});
