/**
 * VenueAlertModal — Set personalised energy alerts for a venue.
 *
 * Users choose:
 *   1. Direction — "At least" (gte) or "At most" (lte)
 *   2. Energy level — quiet / chill / warming / lit / peak
 *   3. Custom label — optional name for the alert
 *   4. Note — optional personal context ("going with Tunde", "need to leave by 1am")
 *
 * Examples:
 *   "Tell me when Quilox is at least LIT" → gte / lit
 *   "Tell me when Escape is at most CHILL — I like it quiet" → lte / chill
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ─── Constants ────────────────────────────────────────────────────────────────

const ENERGY_LEVELS = [
  { value: 'quiet',   label: 'Quiet',   emoji: '🌙', color: '#555E6E', desc: 'Minimal activity' },
  { value: 'chill',   label: 'Chill',   emoji: '😴', color: '#3399FF', desc: 'Low key, relaxed' },
  { value: 'warming', label: 'Warming', emoji: '🌡',  color: '#9B59B6', desc: 'Building energy' },
  { value: 'lit',     label: 'Lit',     emoji: '⚡', color: '#FF9933', desc: 'Real energy now' },
  { value: 'peak',    label: 'Peak',    emoji: '🔥', color: '#FF3366', desc: 'Maximum send' },
] as const;

type EnergyLevel = 'quiet' | 'chill' | 'warming' | 'lit' | 'peak';
type Condition = 'gte' | 'lte';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VenueAlert {
  id: string;
  venue_id: string;
  venue_name: string;
  condition: Condition;
  threshold: EnergyLevel;
  label: string;
  note?: string;
  active: boolean;
  last_triggered?: string | null;
  created_at: string;
}

interface Props {
  visible: boolean;
  venueId: string;
  venueName: string;
  existingAlerts?: VenueAlert[];   // alerts already set for this venue
  onClose: () => void;
  onSaved?: (alert: VenueAlert) => void;
  onDeleted?: (alertId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VenueAlertModal({
  visible,
  venueId,
  venueName,
  existingAlerts = [],
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const { user } = useVibeStore();

  const [condition, setCondition] = useState<Condition>('gte');
  const [threshold, setThreshold] = useState<EnergyLevel>('lit');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setCondition('gte');
      setThreshold('lit');
      setLabel('');
      setNote('');
      setError('');
      setSuccess('');
    }
  }, [visible]);

  const conditionPhrase = condition === 'gte' ? 'at least' : 'at most';
  const previewLabel = label.trim() || `When ${venueName} is ${conditionPhrase} ${threshold}`;

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/alerts/venue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          condition,
          threshold,
          label: label.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Failed to save alert');
      setSuccess('Alert saved');
      onSaved?.(data.alert);
      setTimeout(onClose, 900);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!user?.id) return;
    setDeleting(alertId);
    try {
      await fetch(`${API_URL}/api/alerts/venue/${alertId}`, {
        method: 'DELETE',
      });
      onDeleted?.(alertId);
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (alert: VenueAlert) => {
    try {
      await fetch(`${API_URL}/api/alerts/venue/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !alert.active }),
      });
      onSaved?.({ ...alert, active: !alert.active });
    } catch {
      // silent
    }
  };

  const selectedEnergy = ENERGY_LEVELS.find(e => e.value === threshold)!;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Set Alert</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{venueName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#888" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Existing alerts for this venue */}
          {existingAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR ALERTS FOR THIS VENUE</Text>
              {existingAlerts.map(alert => {
                const lvl = ENERGY_LEVELS.find(e => e.value === alert.threshold);
                return (
                  <View key={alert.id} style={[styles.existingCard, !alert.active && styles.existingCardPaused]}>
                    <View style={styles.existingLeft}>
                      <Text style={styles.existingEmoji}>{lvl?.emoji ?? '⚡'}</Text>
                      <View>
                        <Text style={styles.existingLabel} numberOfLines={1}>{alert.label}</Text>
                        {alert.note ? <Text style={styles.existingNote} numberOfLines={1}>{alert.note}</Text> : null}
                        <Text style={[styles.existingCondition, { color: lvl?.color ?? '#888' }]}>
                          {alert.condition === 'gte' ? 'At least' : 'At most'} {alert.threshold}
                          {!alert.active ? ' · Paused' : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.existingActions}>
                      <TouchableOpacity
                        onPress={() => handleToggle(alert)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={alert.active ? 'pause-circle-outline' : 'play-circle-outline'}
                          size={20}
                          color={alert.active ? '#FF9933' : '#3399FF'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(alert.id)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {deleting === alert.id
                          ? <ActivityIndicator size="small" color="#FF3366" />
                          : <Ionicons name="trash-outline" size={18} color="#FF3366" />
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── New alert form ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NEW ALERT</Text>

            {/* Direction chips */}
            <Text style={styles.fieldLabel}>Notify me when the vibe is...</Text>
            <View style={styles.chipRow}>
              {(['gte', 'lte'] as Condition[]).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, condition === c && styles.chipActive]}
                  onPress={() => setCondition(c)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>
                    {c === 'gte' ? 'At least →' : '← At most'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Energy level selector */}
            <Text style={styles.fieldLabel}>Energy level</Text>
            <View style={styles.energyRow}>
              {ENERGY_LEVELS.map(lvl => (
                <TouchableOpacity
                  key={lvl.value}
                  style={[
                    styles.energyCard,
                    threshold === lvl.value && {
                      borderColor: lvl.color,
                      backgroundColor: `${lvl.color}18`,
                    },
                  ]}
                  onPress={() => setThreshold(lvl.value)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.energyEmoji}>{lvl.emoji}</Text>
                  <Text style={[
                    styles.energyLabel,
                    threshold === lvl.value && { color: lvl.color },
                  ]}>
                    {lvl.label}
                  </Text>
                  <Text style={styles.energyDesc}>{lvl.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            <LinearGradient
              colors={[`${selectedEnergy.color}18`, `${selectedEnergy.color}06`]}
              style={[styles.preview, { borderColor: `${selectedEnergy.color}40` }]}
            >
              <Text style={styles.previewEmoji}>{selectedEnergy.emoji}</Text>
              <Text style={[styles.previewText, { color: selectedEnergy.color }]}>
                {`Notify me when ${venueName} is ${conditionPhrase} `}
                <Text style={{ fontWeight: '900' }}>{threshold.toUpperCase()}</Text>
              </Text>
            </LinearGradient>

            {/* Custom label */}
            <Text style={styles.fieldLabel}>Alert name (optional)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder={previewLabel}
              placeholderTextColor="#444"
              maxLength={60}
            />

            {/* Note */}
            <Text style={styles.fieldLabel}>Personal note (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputNote]}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Going with Tunde — need to leave by 1am"
              placeholderTextColor="#444"
              maxLength={100}
              multiline
            />

            {/* Error / success */}
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!success && <Text style={styles.successText}>{success}</Text>}

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.82}
              disabled={saving}
            >
              <LinearGradient
                colors={['#FF3366', '#FF6633']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtnGradient}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.saveBtnText}>Save Alert</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080810',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EEE',
  },
  headerSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 4,
  },
  section: {
    marginTop: 20,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#444',
    letterSpacing: 2,
    marginBottom: 4,
  },

  // Existing alert cards
  existingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E0E1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A26',
    padding: 12,
  },
  existingCardPaused: {
    opacity: 0.5,
  },
  existingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  existingEmoji: {
    fontSize: 22,
  },
  existingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CCC',
  },
  existingNote: {
    fontSize: 11,
    color: '#555',
    marginTop: 1,
  },
  existingCondition: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  existingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 4,
  },

  // Form fields
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1,
    marginBottom: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    backgroundColor: '#0D0D1A',
  },
  chipActive: {
    borderColor: '#FF3366',
    backgroundColor: '#FF336618',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  chipTextActive: {
    color: '#FF3366',
  },

  // Energy level picker
  energyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  energyCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A26',
    backgroundColor: '#0D0D1A',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
  },
  energyEmoji: {
    fontSize: 18,
  },
  energyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 0.5,
  },
  energyDesc: {
    fontSize: 8,
    color: '#444',
    textAlign: 'center',
    lineHeight: 10,
  },

  // Preview banner
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  previewEmoji: { fontSize: 20 },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },

  // Inputs
  input: {
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#1E1E2A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#DDD',
    fontSize: 14,
  },
  inputNote: {
    minHeight: 56,
    textAlignVertical: 'top',
  },

  errorText: {
    fontSize: 12,
    color: '#FF3366',
    textAlign: 'center',
  },
  successText: {
    fontSize: 12,
    color: '#00E676',
    textAlign: 'center',
  },

  // Save button
  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
