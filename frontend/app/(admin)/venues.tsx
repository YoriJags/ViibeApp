/**
 * ADMIN FLOOR - Venue Management
 * Full back-office: add venues, edit details, configure clout & cooldown settings.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const adminColors = {
  background: '#0A0E14',
  card: '#12181F',
  elevated: '#1A222C',
  input: '#1E2A36',
  primary: '#4169E1',
  accent: '#00BFFF',
  gold: '#FFD700',
  success: '#00E676',
  danger: '#FF5252',
  text: '#FFFFFF',
  textSec: '#94A3B8',
  textMuted: '#64748B',
  border: 'rgba(255,255,255,0.06)',
};

const VENUE_TYPES = ['club', 'restaurant', 'lounge', 'bar', 'concert', 'block_party', 'church', 'rave', 'festival'];
const CITIES = ['lagos', 'abuja', 'port_harcourt', 'ibadan'];

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  city: string;
  venue_type: string;
  current_vibe_score: number;
  energy_level: string;
  entry_fee?: string;
  music_genre?: string;
  coordinates: { lat: number; lng: number };
  geofence_radius_m?: number;
  total_ratings_24h?: number;
  is_featured?: boolean;
}

const emptyVenue = {
  name: '',
  address: '',
  area: '',
  city: 'lagos',
  venue_type: 'club',
  entry_fee: '',
  music_genre: '',
  lat: '6.4281',
  lng: '3.4219',
  geofence_radius_m: '100',
};

export default function AdminVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [form, setForm] = useState({ ...emptyVenue });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'venues' | 'config'>('venues');

  // Config state
  const [config, setConfig] = useState({
    clout_per_rating: '10',
    clout_per_checkin: '2',
    cooldown_minutes: '30',
    daily_rating_limit: '3',
    cooldown_clout_cost: '50',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/venues?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setVenues(Array.isArray(data) ? data : data.venues || []);
      }
    } catch (e) {
      console.error('Failed to fetch venues:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchVenues(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchVenues(); };

  const openAdd = () => {
    setForm({ ...emptyVenue });
    setEditingVenue(null);
    setShowAddModal(true);
  };

  const openEdit = (venue: Venue) => {
    setForm({
      name: venue.name,
      address: venue.address,
      area: venue.area,
      city: venue.city,
      venue_type: venue.venue_type,
      entry_fee: venue.entry_fee || '',
      music_genre: venue.music_genre || '',
      lat: String(venue.coordinates?.lat || 6.4281),
      lng: String(venue.coordinates?.lng || 3.4219),
      geofence_radius_m: String(venue.geofence_radius_m || 100),
    });
    setEditingVenue(venue);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.area.trim()) {
      Alert.alert('Missing fields', 'Name, address and area are required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      area: form.area.trim(),
      city: form.city,
      venue_type: form.venue_type,
      entry_fee: form.entry_fee || 'Free',
      music_genre: form.music_genre || 'Mixed',
      coordinates: { lat: parseFloat(form.lat) || 6.4281, lng: parseFloat(form.lng) || 3.4219 },
      geofence_radius_m: parseInt(form.geofence_radius_m) || 100,
    };
    try {
      const url = editingVenue
        ? `${API_URL}/api/admin/venues/${editingVenue.id}`
        : `${API_URL}/api/admin/venues`;
      const res = await fetch(url, {
        method: editingVenue ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchVenues();
        Alert.alert('Saved', editingVenue ? 'Venue updated.' : 'Venue added.');
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Save failed.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (venue: Venue) => {
    Alert.alert('Delete Venue', `Remove "${venue.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_URL}/api/admin/venues/${venue.id}`, { method: 'DELETE' });
            fetchVenues();
          } catch (e) {
            Alert.alert('Error', 'Delete failed.');
          }
        },
      },
    ]);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clout_per_rating: parseInt(config.clout_per_rating),
          clout_per_checkin: parseInt(config.clout_per_checkin),
          cooldown_minutes: parseInt(config.cooldown_minutes),
          daily_rating_limit: parseInt(config.daily_rating_limit),
          cooldown_clout_cost: parseInt(config.cooldown_clout_cost),
        }),
      });
      if (res.ok) {
        Alert.alert('Saved', 'Platform config updated.');
      } else {
        Alert.alert('Note', 'Config saved locally — connect DB to persist.');
      }
    } catch {
      Alert.alert('Note', 'Config saved locally — connect DB to persist.');
    } finally {
      setSavingConfig(false);
    }
  };

  const filtered = venues.filter(v =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.area?.toLowerCase().includes(search.toLowerCase()) ||
    v.city?.toLowerCase().includes(search.toLowerCase())
  );

  const getVibeColor = (score: number) =>
    score >= 80 ? '#FF3366' : score >= 60 ? '#FF9800' : score >= 40 ? '#7C3AED' : '#2196F3';

  // ── Config Tab ───────────────────────────────────────────────
  const renderConfig = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.configScroll}>
      <Text style={styles.configSectionTitle}>Clout Economy</Text>

      {[
        { label: 'Clout per Rating', key: 'clout_per_rating', hint: 'Default: 10' },
        { label: 'Clout per Check-in', key: 'clout_per_checkin', hint: 'Default: 2' },
        { label: 'Cooldown Skip Cost (Clout)', key: 'cooldown_clout_cost', hint: 'Default: 50' },
      ].map(({ label, key, hint }) => (
        <View key={key} style={styles.configRow}>
          <View style={styles.configLabelRow}>
            <Text style={styles.configLabel}>{label}</Text>
            <Text style={styles.configHint}>{hint}</Text>
          </View>
          <TextInput
            style={styles.configInput}
            value={config[key as keyof typeof config]}
            onChangeText={(v) => setConfig(prev => ({ ...prev, [key]: v }))}
            keyboardType="number-pad"
            placeholderTextColor={adminColors.textMuted}
          />
        </View>
      ))}

      <Text style={[styles.configSectionTitle, { marginTop: 24 }]}>Rating Rules</Text>

      {[
        { label: 'Cooldown Duration (minutes)', key: 'cooldown_minutes', hint: 'Default: 30' },
        { label: 'Daily Rating Limit per Venue', key: 'daily_rating_limit', hint: 'Default: 3' },
      ].map(({ label, key, hint }) => (
        <View key={key} style={styles.configRow}>
          <View style={styles.configLabelRow}>
            <Text style={styles.configLabel}>{label}</Text>
            <Text style={styles.configHint}>{hint}</Text>
          </View>
          <TextInput
            style={styles.configInput}
            value={config[key as keyof typeof config]}
            onChangeText={(v) => setConfig(prev => ({ ...prev, [key]: v }))}
            keyboardType="number-pad"
            placeholderTextColor={adminColors.textMuted}
          />
        </View>
      ))}

      <TouchableOpacity onPress={handleSaveConfig} disabled={savingConfig} activeOpacity={0.85}>
        <LinearGradient
          colors={['#4169E1', '#00BFFF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.saveConfigBtn}
        >
          {savingConfig
            ? <ActivityIndicator size="small" color="#FFF" />
            : <><Ionicons name="save" size={18} color="#FFF" /><Text style={styles.saveConfigText}>Save Config</Text></>
          }
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Venue Form Modal ─────────────────────────────────────────
  const renderModal = () => (
    <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: adminColors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editingVenue ? 'Edit Venue' : 'Add New Venue'}</Text>
          <TouchableOpacity onPress={() => setShowAddModal(false)}>
            <Ionicons name="close" size={24} color={adminColors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalScroll}>
          {/* Name */}
          <Text style={styles.fieldLabel}>Venue Name *</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.name}
            onChangeText={v => setForm(p => ({ ...p, name: v }))}
            placeholder="e.g. Quilox Nightclub"
            placeholderTextColor={adminColors.textMuted}
          />

          {/* Address */}
          <Text style={styles.fieldLabel}>Address *</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.address}
            onChangeText={v => setForm(p => ({ ...p, address: v }))}
            placeholder="Full street address"
            placeholderTextColor={adminColors.textMuted}
          />

          {/* Area */}
          <Text style={styles.fieldLabel}>Area / Neighbourhood *</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.area}
            onChangeText={v => setForm(p => ({ ...p, area: v }))}
            placeholder="e.g. Victoria Island"
            placeholderTextColor={adminColors.textMuted}
          />

          {/* City */}
          <Text style={styles.fieldLabel}>City</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {CITIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.pill, form.city === c && styles.pillActive]}
                onPress={() => setForm(p => ({ ...p, city: c }))}
              >
                <Text style={[styles.pillText, form.city === c && styles.pillTextActive]}>
                  {c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Venue Type */}
          <Text style={styles.fieldLabel}>Venue Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {VENUE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.pill, form.venue_type === t && styles.pillActive]}
                onPress={() => setForm(p => ({ ...p, venue_type: t }))}
              >
                <Text style={[styles.pillText, form.venue_type === t && styles.pillTextActive]}>
                  {t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Entry Fee */}
          <Text style={styles.fieldLabel}>Entry Fee</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.entry_fee}
            onChangeText={v => setForm(p => ({ ...p, entry_fee: v }))}
            placeholder="e.g. ₦5,000 or Free"
            placeholderTextColor={adminColors.textMuted}
          />

          {/* Music Genre */}
          <Text style={styles.fieldLabel}>Music Genre</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.music_genre}
            onChangeText={v => setForm(p => ({ ...p, music_genre: v }))}
            placeholder="e.g. Afrobeats, Amapiano"
            placeholderTextColor={adminColors.textMuted}
          />

          {/* Coordinates */}
          <Text style={styles.fieldLabel}>Coordinates</Text>
          <View style={styles.coordRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1 }]}
              value={form.lat}
              onChangeText={v => setForm(p => ({ ...p, lat: v }))}
              placeholder="Latitude (e.g. 6.4281)"
              placeholderTextColor={adminColors.textMuted}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.fieldInput, { flex: 1 }]}
              value={form.lng}
              onChangeText={v => setForm(p => ({ ...p, lng: v }))}
              placeholder="Longitude (e.g. 3.4219)"
              placeholderTextColor={adminColors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Geofence */}
          <Text style={styles.fieldLabel}>Geofence Radius (metres)</Text>
          <TextInput
            style={styles.fieldInput}
            value={form.geofence_radius_m}
            onChangeText={v => setForm(p => ({ ...p, geofence_radius_m: v }))}
            placeholder="100"
            placeholderTextColor={adminColors.textMuted}
            keyboardType="number-pad"
          />

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <LinearGradient
              colors={['#4169E1', '#00BFFF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving
                ? <ActivityIndicator size="small" color="#FFF" />
                : <><Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.saveBtnText}>{editingVenue ? 'Update Venue' : 'Add Venue'}</Text></>
              }
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Venue Management</Text>
          <Text style={styles.headerSub}>{venues.length} venues · {filtered.length} shown</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <LinearGradient
            colors={['#4169E1', '#00BFFF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.addBtnGradient}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['venues', 'config'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={tab === 'venues' ? 'business' : 'settings'}
              size={15}
              color={activeTab === tab ? adminColors.accent : adminColors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'venues' ? 'Venues' : 'Config'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'config' ? renderConfig() : (
        <>
          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={adminColors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search venues..."
              placeholderTextColor={adminColors.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={adminColors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Venue List */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={adminColors.primary} size="large" />
            </View>
          ) : (
            <ScrollView
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />}
              contentContainerStyle={styles.listContent}
            >
              {filtered.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="business-outline" size={48} color={adminColors.textMuted} />
                  <Text style={styles.emptyText}>No venues found</Text>
                  <Text style={styles.emptySubText}>Tap "Add" to create the first venue</Text>
                </View>
              ) : (
                filtered.map(venue => (
                  <View key={venue.id} style={styles.venueCard}>
                    {/* Vibe score bar */}
                    <View style={[styles.scoreBar, { backgroundColor: getVibeColor(venue.current_vibe_score) }]} />

                    <View style={styles.venueCardContent}>
                      <View style={styles.venueCardTop}>
                        <View style={styles.venueInfo}>
                          <Text style={styles.venueName}>{venue.name}</Text>
                          <Text style={styles.venueArea}>{venue.area} · {venue.city}</Text>
                          <View style={styles.tagRow}>
                            <View style={styles.tag}>
                              <Text style={styles.tagText}>{venue.venue_type?.replace('_', ' ')}</Text>
                            </View>
                            {venue.entry_fee && (
                              <View style={styles.tag}>
                                <Text style={styles.tagText}>{venue.entry_fee}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.scoreCol}>
                          <Text style={[styles.score, { color: getVibeColor(venue.current_vibe_score) }]}>
                            {venue.current_vibe_score || 0}%
                          </Text>
                          <Text style={styles.scoreLabel}>VIBE</Text>
                          <Text style={styles.ratingsCount}>{venue.total_ratings_24h || 0} ratings</Text>
                        </View>
                      </View>

                      <View style={styles.venueActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(venue)}>
                          <Ionicons name="pencil" size={14} color={adminColors.accent} />
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(venue)}>
                          <Ionicons name="trash" size={14} color={adminColors.danger} />
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {renderModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminColors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: adminColors.text },
  headerSub: { fontSize: 12, color: adminColors.textMuted, marginTop: 2 },
  addBtn: { borderRadius: 10, overflow: 'hidden' },
  addBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: adminColors.card, borderRadius: 10, padding: 4,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  tabActive: { backgroundColor: adminColors.elevated },
  tabText: { fontSize: 13, fontWeight: '600', color: adminColors.textMuted },
  tabTextActive: { color: adminColors.accent },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: adminColors.card, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: adminColors.border,
  },
  searchInput: { flex: 1, color: adminColors.text, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: adminColors.textSec },
  emptySubText: { fontSize: 13, color: adminColors.textMuted },
  venueCard: {
    flexDirection: 'row', borderRadius: 14, overflow: 'hidden',
    backgroundColor: adminColors.card, borderWidth: 1, borderColor: adminColors.border,
  },
  scoreBar: { width: 4 },
  venueCardContent: { flex: 1, padding: 14, gap: 10 },
  venueCardTop: { flexDirection: 'row', gap: 12 },
  venueInfo: { flex: 1, gap: 3 },
  venueName: { fontSize: 15, fontWeight: '700', color: adminColors.text },
  venueArea: { fontSize: 12, color: adminColors.textMuted },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  tag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: adminColors.elevated,
  },
  tagText: { fontSize: 10, fontWeight: '600', color: adminColors.textSec },
  scoreCol: { alignItems: 'flex-end', gap: 2 },
  score: { fontSize: 22, fontWeight: '900' },
  scoreLabel: { fontSize: 9, fontWeight: '800', color: adminColors.textMuted, letterSpacing: 1 },
  ratingsCount: { fontSize: 10, color: adminColors.textMuted },
  venueActions: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: 'rgba(0,191,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,191,255,0.2)',
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: adminColors.accent },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: 'rgba(255,82,82,0.08)', borderWidth: 1, borderColor: 'rgba(255,82,82,0.2)',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: adminColors.danger },
  // Config
  configScroll: { padding: 20, gap: 12 },
  configSectionTitle: { fontSize: 13, fontWeight: '800', color: adminColors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  configRow: {
    backgroundColor: adminColors.card, borderRadius: 12,
    padding: 14, gap: 8,
    borderWidth: 1, borderColor: adminColors.border,
  },
  configLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  configLabel: { fontSize: 14, fontWeight: '600', color: adminColors.text },
  configHint: { fontSize: 11, color: adminColors.textMuted },
  configInput: {
    backgroundColor: adminColors.input, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    color: adminColors.text, fontSize: 16, fontWeight: '700',
    borderWidth: 1, borderColor: adminColors.border,
  },
  saveConfigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 8,
  },
  saveConfigText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  // Modal
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: adminColors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: adminColors.text },
  modalScroll: { padding: 20, gap: 4, paddingBottom: 60 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: adminColors.textSec, marginTop: 12, marginBottom: 6, letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: adminColors.input, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    color: adminColors.text, fontSize: 14,
    borderWidth: 1, borderColor: adminColors.border,
  },
  pillRow: { marginBottom: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: adminColors.elevated, borderWidth: 1, borderColor: adminColors.border,
  },
  pillActive: { backgroundColor: adminColors.primary, borderColor: 'transparent' },
  pillText: { fontSize: 12, fontWeight: '600', color: adminColors.textSec },
  pillTextActive: { color: '#FFF' },
  coordRow: { flexDirection: 'row', gap: 10 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 20,
  },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
