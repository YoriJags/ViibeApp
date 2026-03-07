/**
 * Venue Claim Screen — Self-serve merchant onboarding
 * Step 1: Search for your venue
 * Step 2: Submit claim details
 * Step 3: Confirmation (admin reviews in 24-48h)
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../src/store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VenueResult {
  id: string;
  name: string;
  area: string;
  venue_type: string;
  claim_status: string;
}

type Step = 'search' | 'form' | 'done';

export default function ClaimScreen() {
  const router = useRouter();
  const { user, getAuthHeaders } = useVibeStore();

  const [step, setStep] = useState<Step>('search');

  // Step 1 — search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VenueResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueResult | null>(null);

  // Step 2 — form
  const [ownerName, setOwnerName] = useState(user?.username || '');
  const [phone, setPhone] = useState('');
  const [businessRegNo, setBusinessRegNo] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(`${API_URL}/api/venues/search?q=${encodeURIComponent(query.trim())}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.venues || []);
      }
    } catch {
      Alert.alert('Error', 'Could not search venues. Check your connection.');
    }
    setSearching(false);
  }, [query, getAuthHeaders]);

  const handleSelectVenue = (venue: VenueResult) => {
    if (venue.claim_status === 'claimed') {
      Alert.alert('Already Claimed', 'This venue has already been claimed by another merchant.');
      return;
    }
    if (venue.claim_status === 'pending') {
      Alert.alert('Claim Pending', 'A claim is already pending for this venue. Contact support if this is your business.');
      return;
    }
    setSelectedVenue(venue);
    setStep('form');
  };

  const handleSubmitClaim = async () => {
    if (!ownerName.trim() || !phone.trim()) {
      Alert.alert('Missing Info', 'Please enter your name and phone number.');
      return;
    }
    if (!selectedVenue) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/claim/venue/${selectedVenue.id}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: ownerName.trim(),
          phone: phone.trim(),
          business_reg_no: businessRegNo.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (res.ok) {
        setStep('done');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Error', err.detail || 'Could not submit claim. Try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'form' ? setStep('search') : router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Claim Your Venue</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Progress dots */}
      <View style={styles.progress}>
        {(['search', 'form', 'done'] as Step[]).map((s, i) => (
          <View key={s} style={[styles.dot, step === s && styles.dotActive, i < (['search', 'form', 'done'] as Step[]).indexOf(step) && styles.dotDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── STEP 1: SEARCH ── */}
        {step === 'search' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Find your venue</Text>
            <Text style={styles.stepSubtitle}>Search by venue name to get started</Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. Quilox, The Escape..."
                placeholderTextColor="#444"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoFocus
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                {searching
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="search" size={20} color="#FFF" />
                }
              </TouchableOpacity>
            </View>

            {results.length > 0 && (
              <View style={styles.resultsList}>
                {results.map(v => (
                  <TouchableOpacity key={v.id} style={styles.resultRow} onPress={() => handleSelectVenue(v)}>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{v.name}</Text>
                      <Text style={styles.resultMeta}>{v.area} · {v.venue_type}</Text>
                    </View>
                    {v.claim_status === 'claimed'
                      ? <View style={styles.claimedBadge}><Text style={styles.claimedText}>Claimed</Text></View>
                      : v.claim_status === 'pending'
                        ? <View style={[styles.claimedBadge, { borderColor: '#FF9933' }]}><Text style={[styles.claimedText, { color: '#FF9933' }]}>Pending</Text></View>
                        : <Ionicons name="chevron-forward" size={18} color="#444" />
                    }
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {results.length === 0 && query.trim().length >= 2 && !searching && (
              <Text style={styles.noResults}>No venues found. Try a different name.</Text>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={16} color="#FF9933" />
              <Text style={styles.infoText}>
                Your venue must already exist on Viibe. If it's not listed, contact us to have it added.
              </Text>
            </View>
          </View>
        )}

        {/* ── STEP 2: CLAIM FORM ── */}
        {step === 'form' && selectedVenue && (
          <View style={styles.stepContent}>
            <View style={styles.selectedVenueCard}>
              <Ionicons name="business" size={20} color="#FF3366" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.selectedVenueName}>{selectedVenue.name}</Text>
                <Text style={styles.selectedVenueMeta}>{selectedVenue.area}</Text>
              </View>
            </View>

            <Text style={styles.stepTitle}>Your details</Text>
            <Text style={styles.stepSubtitle}>We'll verify and approve within 24–48 hours</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Owner / Manager Name *</Text>
              <TextInput
                style={styles.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="Full name"
                placeholderTextColor="#444"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Business Phone *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+234 800 000 0000"
                placeholderTextColor="#444"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Business Reg Number (optional)</Text>
              <TextInput
                style={styles.input}
                value={businessRegNo}
                onChangeText={setBusinessRegNo}
                placeholder="CAC / RC Number"
                placeholderTextColor="#444"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Message (optional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={message}
                onChangeText={setMessage}
                placeholder="Anything else you'd like us to know..."
                placeholderTextColor="#444"
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmitClaim}
              disabled={submitting}
            >
              <LinearGradient colors={['#FF3366', '#CC0044']} style={styles.submitGradient}>
                {submitting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={styles.submitText}>Submit Claim</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: DONE ── */}
        {step === 'done' && (
          <View style={[styles.stepContent, { alignItems: 'center', paddingTop: 40 }]}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.doneTitle}>Claim Submitted!</Text>
            <Text style={styles.doneSubtitle}>
              Our team will review your claim and get back to you within 24–48 hours.{'\n\n'}
              Once approved, you'll unlock the full merchant dashboard for {selectedVenue?.name}.
            </Text>

            <View style={styles.doneSteps}>
              {['Claim received', 'Admin review (24–48h)', 'Merchant access granted'].map((s, i) => (
                <View key={s} style={styles.doneStep}>
                  <View style={[styles.doneStepDot, i === 0 && { backgroundColor: '#4CAF50' }]}>
                    <Text style={styles.doneStepNum}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.doneStepLabel, i === 0 && { color: '#4CAF50' }]}>{s}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(public)')}>
              <Text style={styles.doneBtnText}>Back to Viibe</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080810' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A28',
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#252530' },
  dotActive: { backgroundColor: '#FF3366', width: 24 },
  dotDone: { backgroundColor: '#4CAF50' },
  scroll: { padding: 20, paddingBottom: 60 },
  stepContent: { gap: 16 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  stepSubtitle: { fontSize: 13, color: '#666', marginTop: -10 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: '#111118',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252530',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFF',
  },
  searchBtn: {
    backgroundColor: '#FF3366',
    borderRadius: 12,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsList: { gap: 8, marginTop: 4 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111118',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252530',
    padding: 14,
    gap: 12,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  resultMeta: { fontSize: 11, color: '#555', marginTop: 2 },
  claimedBadge: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  claimedText: { fontSize: 10, fontWeight: '700', color: '#555' },
  noResults: { fontSize: 13, color: '#444', textAlign: 'center', paddingVertical: 16 },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#1A1200',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF993330',
    padding: 12,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: '#AA8050', lineHeight: 18 },
  selectedVenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF336610',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF336630',
    padding: 14,
  },
  selectedVenueName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  selectedVenueMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#111118',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252530',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFF',
  },
  submitBtn: { marginTop: 8 },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  submitText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  doneIcon: { marginBottom: 16 },
  doneTitle: { fontSize: 26, fontWeight: '900', color: '#FFF' },
  doneSubtitle: { fontSize: 13, color: '#777', lineHeight: 20, textAlign: 'center' },
  doneSteps: { width: '100%', gap: 12, marginTop: 8 },
  doneStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneStepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#252530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneStepNum: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  doneStepLabel: { fontSize: 13, color: '#888' },
  doneBtn: {
    marginTop: 24,
    backgroundColor: '#1A1A28',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
