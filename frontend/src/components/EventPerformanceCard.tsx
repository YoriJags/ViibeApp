/**
 * EventPerformanceCard — Merchant event tracker.
 * Log events, get a baseline prediction, see actual vs predicted after the night.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const EVENT_TYPES = ['DJ Night', 'Live Band', 'Open Bar', 'Themed Night', 'Industry Night', 'Private Party', 'Other'];

interface VenueEvent {
  id: string;
  name: string;
  event_type: string;
  expected_start: string;
  expected_end: string;
  expected_crowd?: number;
  baseline_score: number;
  actual_score: number | null;
  rating_count: number;
  status: 'upcoming' | 'live' | 'completed';
}

interface Props {
  venueId: string;
  authToken: string;
  demoData?: { events: VenueEvent[] };
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function daysUntil(iso: string): string {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'tonight';
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}

const STATUS_CONFIG = {
  upcoming: { color: '#9933FF', bg: '#9933FF15', label: 'UPCOMING' },
  live:     { color: '#FF3366', bg: '#FF336615', label: 'LIVE NOW' },
  completed:{ color: '#4CAF50', bg: '#4CAF5015', label: 'COMPLETED' },
};

export default function EventPerformanceCard({ venueId, authToken, demoData }: Props) {
  const [events, setEvents] = useState<VenueEvent[]>(demoData?.events ?? []);
  const [loading, setLoading] = useState(!demoData);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('DJ Night');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('22:00');
  const [formEndTime, setFormEndTime] = useState('03:00');
  const [formCrowd, setFormCrowd] = useState('');

  const fetchEvents = useCallback(async () => {
    if (demoData) return;
    try {
      const res = await fetch(`${API_URL}/api/merchant/venues/${venueId}/events`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setEvents(json.events ?? []);
      }
    } catch {}
    setLoading(false);
  }, [venueId, authToken, demoData]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleCreate = async () => {
    if (!formName.trim() || !formDate) return;
    setSaving(true);
    try {
      // Parse date + times into ISO
      const startISO = new Date(`${formDate}T${formStartTime}:00`).toISOString();
      // End time: if end < start (crosses midnight), add 1 day
      let endDate = new Date(`${formDate}T${formEndTime}:00`);
      if (endDate <= new Date(`${formDate}T${formStartTime}:00`)) {
        endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      }
      const endISO = endDate.toISOString();

      if (!demoData) {
        const res = await fetch(`${API_URL}/api/merchant/venues/${venueId}/events`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            event_type: formType,
            expected_start: startISO,
            expected_end: endISO,
            expected_crowd: formCrowd ? parseInt(formCrowd, 10) : undefined,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setEvents(prev => [created, ...prev]);
        }
      } else {
        // Demo mode — fake the new event locally
        const fake: VenueEvent = {
          id: `demo_new_${Date.now()}`,
          name: formName.trim(),
          event_type: formType,
          expected_start: startISO,
          expected_end: endISO,
          expected_crowd: formCrowd ? parseInt(formCrowd, 10) : undefined,
          baseline_score: 65,
          actual_score: null,
          rating_count: 0,
          status: 'upcoming',
        };
        setEvents(prev => [fake, ...prev]);
      }

      setShowModal(false);
      setFormName(''); setFormDate(''); setFormCrowd('');
      setFormStartTime('22:00'); setFormEndTime('03:00'); setFormType('DJ Night');
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (eventId: string) => {
    if (!demoData) {
      try {
        await fetch(`${API_URL}/api/merchant/venues/${venueId}/events/${eventId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {}
    }
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="small" color="#FF3366" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>EVENT PERFORMANCE</Text>
          <Text style={styles.subtitle}>Predicted vs actual vibe score</Text>
        </View>
        <TouchableOpacity style={styles.logBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={14} color="#FFF" />
          <Text style={styles.logBtnText}>Log Event</Text>
        </TouchableOpacity>
      </View>

      {/* Event list */}
      {events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No events logged yet.</Text>
          <Text style={styles.emptyHint}>Log your next event to track performance.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {events.map((ev) => {
            const status = STATUS_CONFIG[ev.status];
            const isCompleted = ev.status === 'completed';
            const maxScore = Math.max(ev.baseline_score, ev.actual_score ?? 0, 1);
            const beat = isCompleted && ev.actual_score !== null && ev.actual_score > ev.baseline_score;

            return (
              <View key={ev.id} style={styles.eventCard}>
                {/* Event header row */}
                <View style={styles.eventTop}>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventName}>{ev.name}</Text>
                    <Text style={styles.eventMeta}>
                      {ev.event_type} · {formatEventDate(ev.expected_start)} · {formatTime(ev.expected_start)}
                    </Text>
                  </View>
                  <View style={styles.eventRight}>
                    <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(ev.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={14} color="#444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Score comparison bars */}
                <View style={styles.barsRow}>
                  {/* Predicted */}
                  <View style={styles.barBlock}>
                    <Text style={styles.barLabel}>PREDICTED</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(ev.baseline_score / 100) * 100}%`, backgroundColor: '#9933FF' }]} />
                    </View>
                    <Text style={styles.barValue}>{ev.baseline_score}%</Text>
                  </View>

                  {/* Actual — only for completed */}
                  {isCompleted && ev.actual_score !== null ? (
                    <View style={styles.barBlock}>
                      <Text style={styles.barLabel}>ACTUAL</Text>
                      <View style={styles.barTrack}>
                        <View style={[
                          styles.barFill,
                          { width: `${(ev.actual_score / 100) * 100}%`, backgroundColor: beat ? '#4CAF50' : '#FF5252' },
                        ]} />
                      </View>
                      <Text style={[styles.barValue, { color: beat ? '#4CAF50' : '#FF5252' }]}>
                        {ev.actual_score}% {beat ? '↑' : '↓'}
                      </Text>
                    </View>
                  ) : ev.status === 'upcoming' ? (
                    <View style={styles.barBlock}>
                      <Text style={styles.barLabel}>FORECAST</Text>
                      <Text style={styles.upcomingText}>{daysUntil(ev.expected_start)}</Text>
                      {ev.expected_crowd && (
                        <Text style={styles.crowdText}>~{ev.expected_crowd} expected</Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.barBlock}>
                      <Text style={styles.barLabel}>LIVE NOW</Text>
                      <Text style={[styles.upcomingText, { color: '#FF3366' }]}>{ev.rating_count} ratings in</Text>
                    </View>
                  )}
                </View>

                {/* Completed summary line */}
                {isCompleted && ev.actual_score !== null && (
                  <LinearGradient
                    colors={beat ? ['#4CAF5015', '#4CAF5005'] : ['#FF525215', '#FF525205']}
                    style={styles.resultBadge}
                  >
                    <Text style={[styles.resultText, { color: beat ? '#4CAF50' : '#FF5252' }]}>
                      {beat
                        ? `Beat prediction by ${ev.actual_score - ev.baseline_score} points · ${ev.rating_count} scouts rated`
                        : `Missed by ${ev.baseline_score - ev.actual_score} points · ${ev.rating_count} scouts rated`}
                    </Text>
                  </LinearGradient>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Create Event Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Event</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>EVENT NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Afrobeats Fridays Vol. 8"
                  placeholderTextColor="#444"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>EVENT TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
                  {EVENT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, formType === t && styles.typeChipActive]}
                      onPress={() => setFormType(t)}
                    >
                      <Text style={[styles.typeChipText, formType === t && { color: '#FFF' }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2026-03-07"
                  placeholderTextColor="#444"
                  value={formDate}
                  onChangeText={setFormDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>START TIME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="22:00"
                    placeholderTextColor="#444"
                    value={formStartTime}
                    onChangeText={setFormStartTime}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>END TIME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="03:00"
                    placeholderTextColor="#444"
                    value={formEndTime}
                    onChangeText={setFormEndTime}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>EXPECTED CROWD SIZE (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 300"
                  placeholderTextColor="#444"
                  value={formCrowd}
                  onChangeText={setFormCrowd}
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (!formName.trim() || !formDate) && styles.saveBtnDisabled]}
                onPress={handleCreate}
                disabled={saving || !formName.trim() || !formDate}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.saveBtnText}>Log Event</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111118',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252530',
    marginVertical: 8,
    overflow: 'hidden',
  },
  loadingWrapper: { padding: 24, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 10, fontWeight: '800', color: '#FF3366', letterSpacing: 2 },
  subtitle: { fontSize: 11, color: '#555', marginTop: 2 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF3366',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  empty: { padding: 24, alignItems: 'center', gap: 4 },
  emptyText: { fontSize: 13, color: '#555', fontWeight: '600' },
  emptyHint: { fontSize: 11, color: '#333' },
  list: { padding: 12, gap: 10 },
  eventCard: {
    backgroundColor: '#0D0D14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E2A',
    padding: 12,
    gap: 10,
  },
  eventTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eventInfo: { flex: 1, gap: 3 },
  eventName: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  eventMeta: { fontSize: 11, color: '#555' },
  eventRight: { alignItems: 'flex-end', gap: 6 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  barsRow: { flexDirection: 'row', gap: 12 },
  barBlock: { flex: 1, gap: 5 },
  barLabel: { fontSize: 8, fontWeight: '800', color: '#444', letterSpacing: 1.5 },
  barTrack: {
    height: 8,
    backgroundColor: '#1A1A25',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  upcomingText: { fontSize: 13, fontWeight: '700', color: '#9933FF' },
  crowdText: { fontSize: 10, color: '#555' },
  resultBadge: { borderRadius: 8, padding: 8 },
  resultText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000CC',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  formGroup: { marginBottom: 16, gap: 6 },
  formRow: { flexDirection: 'row', gap: 12 },
  formLabel: { fontSize: 9, fontWeight: '800', color: '#555', letterSpacing: 1.5 },
  input: {
    backgroundColor: '#0D0D14',
    borderWidth: 1,
    borderColor: '#252530',
    borderRadius: 10,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
  },
  typeRow: { flexDirection: 'row' as const },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1A1A25',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#252530',
  },
  typeChipActive: { backgroundColor: '#FF3366', borderColor: '#FF3366' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#888' },
  saveBtn: {
    backgroundColor: '#FF3366',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
