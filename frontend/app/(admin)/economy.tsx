/**
 * ADMIN FLOOR - Economy Config Screen
 * Edit all monetary values: Pulse Drop prices, campaign rates, clout earn rates, fees.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../../src/store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const C = {
  bg: '#0A0E14',
  card: '#12181F',
  elevated: '#1A222C',
  input: '#1E2A36',
  primary: '#4169E1',
  gold: '#FFD700',
  pink: '#FF3366',
  cyan: '#00D4FF',
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
  text: '#FFFFFF',
  textSec: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E3A5F',
  spark: '#FF9800',
  flare: '#E91E63',
  supernova: '#FFD700',
};

interface EconomyConfig {
  pulse_drops: {
    spark: { price: number; duration_hours: number; radius_km: number; glow_boost: number };
    flare: { price: number; duration_hours: number; radius_km: number; glow_boost: number };
    supernova: { price: number; duration_hours: number; radius_km: number; glow_boost: number };
  };
  campaigns: {
    '2x_2h': number; '2x_4h': number; '2x_8h': number;
    '3x_2h': number; '3x_4h': number; '3x_8h': number;
  };
  wallet: { min_topup: number; platform_fee_percent: number };
  clout: { rating_base: number; checkin: number; pulse_drop: number; cooldown_skip_cost: number };
  streaks: { milestone_3d: number; milestone_7d: number; milestone_14d: number; milestone_30d: number };
}

const DEFAULT_CONFIG: EconomyConfig = {
  pulse_drops: {
    spark: { price: 5000, duration_hours: 2, radius_km: 2, glow_boost: 20 },
    flare: { price: 15000, duration_hours: 4, radius_km: 5, glow_boost: 40 },
    supernova: { price: 50000, duration_hours: 8, radius_km: 50, glow_boost: 100 },
  },
  campaigns: {
    '2x_2h': 3000, '2x_4h': 5000, '2x_8h': 8000,
    '3x_2h': 7000, '3x_4h': 12000, '3x_8h': 20000,
  },
  wallet: { min_topup: 1000, platform_fee_percent: 10 },
  clout: { rating_base: 10, checkin: 2, pulse_drop: 3, cooldown_skip_cost: 50 },
  streaks: { milestone_3d: 5, milestone_7d: 15, milestone_14d: 30, milestone_30d: 50 },
};

// ===== Reusable editable row =====
function EditRow({
  label,
  value,
  unit = '',
  prefix = '',
  onSave,
}: {
  label: string;
  value: number;
  unit?: string;
  prefix?: string;
  onSave: (val: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid value', 'Please enter a positive number.');
      return;
    }
    setSaving(true);
    await onSave(num);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.editRowLabel}>{label}</Text>
        <View style={styles.editRowInput}>
          {prefix ? <Text style={styles.editRowPrefix}>{prefix}</Text> : null}
          <TextInput
            style={styles.editInput}
            value={draft}
            onChangeText={setDraft}
            keyboardType="numeric"
            autoFocus
            selectTextOnFocus
          />
          {unit ? <Text style={styles.editRowUnit}>{unit}</Text> : null}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="checkmark" size={16} color="#000" />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setDraft(String(value)); }}>
            <Ionicons name="close" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.editRow} onPress={() => { setDraft(String(value)); setEditing(true); }}>
      <Text style={styles.editRowLabel}>{label}</Text>
      <View style={styles.editRowValue}>
        <Text style={styles.editRowValueText}>
          {prefix}{value.toLocaleString()}{unit}
        </Text>
        <Ionicons name="pencil" size={14} color={C.primary} style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

// ===== Section card =====
function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={18} color={C.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function EconomyScreen() {
  const { getAuthHeaders } = useVibeStore();
  const [config, setConfig] = useState<EconomyConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);

  const headers = getAuthHeaders();

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/economy-config`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setIsDefault(data.is_default);
        setLastUpdated(data.last_updated);
      }
    } catch (e) {
      console.error('Failed to load economy config', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConfig();
    setRefreshing(false);
  }, []);

  const updateSection = async (section: string, updates: Record<string, any>) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/economy-config`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setIsDefault(false);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to save');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error');
    }
  };

  // Helpers to update nested keys
  const updatePulseDrop = async (tier: keyof EconomyConfig['pulse_drops'], field: string, val: number) => {
    await updateSection('pulse_drops', {
      ...config.pulse_drops,
      [tier]: { ...config.pulse_drops[tier], [field]: val },
    });
  };

  const updateCampaign = async (key: keyof EconomyConfig['campaigns'], val: number) => {
    await updateSection('campaigns', { ...config.campaigns, [key]: val });
  };

  const updateWallet = async (field: keyof EconomyConfig['wallet'], val: number) => {
    await updateSection('wallet', { ...config.wallet, [field]: val });
  };

  const updateClout = async (field: keyof EconomyConfig['clout'], val: number) => {
    await updateSection('clout', { ...config.clout, [field]: val });
  };

  const updateStreak = async (field: keyof EconomyConfig['streaks'], val: number) => {
    await updateSection('streaks', { ...config.streaks, [field]: val });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading economy config...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[C.primary, '#2B4FBF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View>
            <Text style={styles.headerTitle}>Economy Config</Text>
            <Text style={styles.headerSub}>
              {isDefault ? 'Using default values' : lastUpdated ? `Last saved ${new Date(lastUpdated).toLocaleDateString()}` : 'Saved'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isDefault ? C.warning + '30' : C.success + '30' }]}>
            <View style={[styles.statusDot, { backgroundColor: isDefault ? C.warning : C.success }]} />
            <Text style={[styles.statusText, { color: isDefault ? C.warning : C.success }]}>
              {isDefault ? 'DEFAULT' : 'CUSTOM'}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.hint}>Tap any value to edit it. Changes take effect immediately.</Text>

          {/* ── PULSE DROP TIERS ── */}
          <SectionCard title="Pulse Drop Tiers" icon="flash">
            {(['spark', 'flare', 'supernova'] as const).map((tier) => {
              const tierColors = { spark: C.spark, flare: C.flare, supernova: C.supernova };
              const t = config.pulse_drops[tier];
              return (
                <View key={tier} style={[styles.tierBlock, { borderColor: tierColors[tier] + '40' }]}>
                  <View style={[styles.tierHeader, { backgroundColor: tierColors[tier] + '15' }]}>
                    <Ionicons
                      name={tier === 'supernova' ? 'star' : tier === 'flare' ? 'flame' : 'flash'}
                      size={16}
                      color={tierColors[tier]}
                    />
                    <Text style={[styles.tierName, { color: tierColors[tier] }]}>
                      {tier.toUpperCase()}
                    </Text>
                  </View>
                  <EditRow label="Price" value={t.price} prefix="₦"
                    onSave={(v) => updatePulseDrop(tier, 'price', v)} />
                  <EditRow label="Duration" value={t.duration_hours} unit=" hrs"
                    onSave={(v) => updatePulseDrop(tier, 'duration_hours', v)} />
                  <EditRow label="Radius" value={t.radius_km} unit=" km"
                    onSave={(v) => updatePulseDrop(tier, 'radius_km', v)} />
                  <EditRow label="Glow Boost" value={t.glow_boost} unit="%"
                    onSave={(v) => updatePulseDrop(tier, 'glow_boost', v)} />
                </View>
              );
            })}
          </SectionCard>

          {/* ── CAMPAIGNS ── */}
          <SectionCard title="Energy Campaigns" icon="megaphone">
            <Text style={styles.tableHeader}>2× Clout Multiplier</Text>
            <EditRow label="2h window" value={config.campaigns['2x_2h']} prefix="₦"
              onSave={(v) => updateCampaign('2x_2h', v)} />
            <EditRow label="4h window" value={config.campaigns['2x_4h']} prefix="₦"
              onSave={(v) => updateCampaign('2x_4h', v)} />
            <EditRow label="8h window" value={config.campaigns['2x_8h']} prefix="₦"
              onSave={(v) => updateCampaign('2x_8h', v)} />
            <View style={styles.divider} />
            <Text style={styles.tableHeader}>3× Clout Multiplier</Text>
            <EditRow label="2h window" value={config.campaigns['3x_2h']} prefix="₦"
              onSave={(v) => updateCampaign('3x_2h', v)} />
            <EditRow label="4h window" value={config.campaigns['3x_4h']} prefix="₦"
              onSave={(v) => updateCampaign('3x_4h', v)} />
            <EditRow label="8h window" value={config.campaigns['3x_8h']} prefix="₦"
              onSave={(v) => updateCampaign('3x_8h', v)} />
          </SectionCard>

          {/* ── WALLET & FEES ── */}
          <SectionCard title="Wallet & Platform Fees" icon="wallet">
            <EditRow label="Minimum top-up" value={config.wallet.min_topup} prefix="₦"
              onSave={(v) => updateWallet('min_topup', v)} />
            <EditRow label="Platform fee" value={config.wallet.platform_fee_percent} unit="%"
              onSave={(v) => updateWallet('platform_fee_percent', v)} />
          </SectionCard>

          {/* ── CLOUT EARN RATES ── */}
          <SectionCard title="Clout Earn Rates" icon="star">
            <EditRow label="Base rating reward" value={config.clout.rating_base} unit=" clout"
              onSave={(v) => updateClout('rating_base', v)} />
            <EditRow label="Check-in reward" value={config.clout.checkin} unit=" clout"
              onSave={(v) => updateClout('checkin', v)} />
            <EditRow label="Quick pulse reward" value={config.clout.pulse_drop} unit=" clout"
              onSave={(v) => updateClout('pulse_drop', v)} />
            <View style={styles.divider} />
            <Text style={styles.tableHeader}>Clout Spend</Text>
            <EditRow label="Skip cooldown cost" value={config.clout.cooldown_skip_cost} unit=" clout"
              onSave={(v) => updateClout('cooldown_skip_cost', v)} />
          </SectionCard>

          {/* ── STREAK MILESTONES ── */}
          <SectionCard title="Streak Milestone Bonuses" icon="flame">
            <EditRow label="3-day milestone" value={config.streaks.milestone_3d} unit=" clout"
              onSave={(v) => updateStreak('milestone_3d', v)} />
            <EditRow label="7-day milestone" value={config.streaks.milestone_7d} unit=" clout"
              onSave={(v) => updateStreak('milestone_7d', v)} />
            <EditRow label="14-day milestone" value={config.streaks.milestone_14d} unit=" clout"
              onSave={(v) => updateStreak('milestone_14d', v)} />
            <EditRow label="30-day milestone" value={config.streaks.milestone_30d} unit=" clout"
              onSave={(v) => updateStreak('milestone_30d', v)} />
          </SectionCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: C.textSec, fontSize: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  body: { padding: 16 },
  hint: {
    fontSize: 13,
    color: C.textMuted,
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  tierBlock: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tierName: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  tableHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  // Edit row
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  editRowLabel: { fontSize: 14, color: C.textSec, flex: 1 },
  editRowValue: { flexDirection: 'row', alignItems: 'center' },
  editRowValueText: { fontSize: 15, fontWeight: '700', color: C.text },
  editRowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editRowPrefix: { fontSize: 15, color: C.success, fontWeight: '600' },
  editRowUnit: { fontSize: 13, color: C.textMuted },
  editInput: {
    backgroundColor: C.input,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 80,
    borderWidth: 1,
    borderColor: C.primary,
  },
  saveBtn: {
    backgroundColor: C.success,
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: C.elevated,
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
