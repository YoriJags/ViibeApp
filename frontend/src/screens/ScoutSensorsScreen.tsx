/**
 * ScoutSensorsScreen
 *
 * Lets scouts choose which background sensors are active while inside a venue.
 * Battery impact is shown with real numbers, not vague labels.
 *
 * Sensor prefs are read from / written to vibeStore (sensorPrefs field).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SensorPrefs {
  ambientSound:   boolean;
  kineticMovement: boolean;
  bleDensity:     boolean;
}

const DEFAULT_PREFS: SensorPrefs = {
  ambientSound:    false,
  kineticMovement: false,
  bleDensity:      false,
};

// ── Sensor metadata ───────────────────────────────────────────────────────────
interface SensorMeta {
  key:         keyof SensorPrefs;
  label:       string;
  icon:        string;
  what:        string;
  dataOutput:  string;
  batteryLine: string;   // specific number shown to user
  permission:  string | null;
  status:      'live' | 'building' | 'pipeline';
}

const SENSORS: SensorMeta[] = [
  {
    key:         'kineticMovement',
    label:       'Kinetic Movement',
    icon:        'body-outline',
    what:        'Detects your physical movement and dancing BPM from phone motion. No tap needed.',
    dataOutput:  'Crowd BPM match, dancing %, movement energy score',
    batteryLine: '~2–4% per hour. Same as a fitness tracker. Auto-pauses when you leave the venue.',
    permission:  null,
    status:      'building',
  },
  {
    key:         'ambientSound',
    label:       'Ambient Sound Level',
    icon:        'mic-outline',
    what:        'Measures room noise level every 30 seconds. No audio is recorded or stored — only a number.',
    dataOutput:  'Room noise floor, peak energy bursts',
    batteryLine: '~0.5–1% per hour. Samples briefly every 30s, sleeps between samples.',
    permission:  'Microphone (required)',
    status:      'live',
  },
  {
    key:         'bleDensity',
    label:       'Crowd Density (BLE)',
    icon:        'bluetooth-outline',
    what:        'Passively counts nearby Bluetooth devices to estimate how packed the crowd is. No device is tracked or identified.',
    dataOutput:  'Crowd density level, zone classification (stage vs lounge)',
    batteryLine: '~1–2% per hour. Scans every 30s, does not maintain any connection.',
    permission:  'Bluetooth (required)',
    status:      'pipeline',
  },
];

const STATUS_LABELS: Record<SensorMeta['status'], string> = {
  live:     'LIVE',
  building: 'IN BUILD',
  pipeline: 'COMING SOON',
};

const STATUS_COLORS: Record<SensorMeta['status'], string> = {
  live:     '#22c55e',
  building: '#f59e0b',
  pipeline: '#6b7280',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ScoutSensorsScreen({ navigation }: any) {
  // Read sensor prefs from store — fall back to defaults if not set
  const storeSensorPrefs  = useVibeStore(s => (s as any).sensorPrefs as SensorPrefs | undefined);
  const setSensorPrefs    = useVibeStore(s => (s as any).setSensorPrefs as ((p: Partial<SensorPrefs>) => void) | undefined);

  const [prefs, setPrefs] = useState<SensorPrefs>(storeSensorPrefs ?? DEFAULT_PREFS);

  const toggle = (key: keyof SensorPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSensorPrefs?.(next);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scout Sensors</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Intro */}
        <View style={styles.introCard}>
          <Ionicons name="pulse-outline" size={20} color="#7c3aed" style={{ marginBottom: 10 }} />
          <Text style={styles.introText}>
            Each sensor contributes a signal to the live crowd intelligence layer. You choose what runs.{'\n\n'}
            <Text style={styles.introBold}>All sensors auto-pause when you leave a venue.</Text>{' '}
            Nothing runs in the background outside a geofence.
          </Text>
        </View>

        {/* Always-on notice */}
        <View style={styles.alwaysOnCard}>
          <View style={styles.alwaysOnLeft}>
            <Ionicons name="radio-button-on-outline" size={18} color="#22c55e" />
            <Text style={styles.alwaysOnLabel}>Tap Rhythm + Vibe Rating</Text>
          </View>
          <Text style={styles.alwaysOnSub}>Always on · No battery cost · No permissions</Text>
        </View>

        {/* Sensor cards */}
        {SENSORS.map(sensor => {
          const isEnabled  = prefs[sensor.key];
          const isPipeline = sensor.status === 'pipeline';

          return (
            <View key={sensor.key} style={[styles.card, isPipeline && styles.cardDimmed]}>

              {/* Top row: icon + label + status badge + toggle */}
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <View style={[styles.iconWrap, isEnabled && styles.iconWrapActive]}>
                    <Ionicons name={sensor.icon as any} size={18} color={isEnabled ? '#7c3aed' : '#64748b'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.sensorLabel, isPipeline && styles.sensorLabelDim]}>
                        {sensor.label}
                      </Text>
                      <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[sensor.status] }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[sensor.status] }]}>
                          {STATUS_LABELS[sensor.status]}
                        </Text>
                      </View>
                    </View>
                    {sensor.permission && (
                      <Text style={styles.permText}>
                        <Ionicons name="lock-closed-outline" size={10} color="#f59e0b" />{' '}
                        {sensor.permission}
                      </Text>
                    )}
                  </View>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={() => { if (!isPipeline) toggle(sensor.key); }}
                  disabled={isPipeline}
                  trackColor={{ false: '#1e1e2e', true: '#5b21b6' }}
                  thumbColor={isEnabled ? '#7c3aed' : '#475569'}
                  ios_backgroundColor="#1e1e2e"
                />
              </View>

              {/* What it does */}
              <Text style={styles.whatText}>{sensor.what}</Text>

              {/* Data output */}
              <View style={styles.outputRow}>
                <Ionicons name="analytics-outline" size={12} color="#7c3aed" />
                <Text style={styles.outputText}>{sensor.dataOutput}</Text>
              </View>

              {/* Battery line — specific numbers */}
              <View style={styles.batteryRow}>
                <Ionicons name="battery-half-outline" size={13} color="#64748b" />
                <Text style={styles.batteryText}>{sensor.batteryLine}</Text>
              </View>

            </View>
          );
        })}

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={14} color="#475569" />
          <Text style={styles.footerText}>
            Battery estimates are based on average hardware. Older devices may see slightly higher usage.
            All sensor data is anonymised before leaving your device.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.2,
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
    gap: 14,
  },
  introCard: {
    backgroundColor: 'rgba(124,58,237,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 4,
  },
  introText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
  introBold: {
    color: '#f1f5f9',
    fontWeight: '600',
  },
  alwaysOnCard: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
    gap: 6,
  },
  alwaysOnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alwaysOnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  alwaysOnSub: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 26,
  },
  card: {
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#1e1e2e',
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  cardDimmed: {
    opacity: 0.6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  sensorLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  sensorLabelDim: {
    color: '#64748b',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  permText: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 3,
  },
  whatText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
  },
  outputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  outputText: {
    fontSize: 12,
    color: '#7c3aed',
    flex: 1,
    lineHeight: 17,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e1e2e',
  },
  batteryText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
    lineHeight: 17,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#0d0d14',
    borderRadius: 10,
  },
  footerText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 17,
    flex: 1,
  },
});
