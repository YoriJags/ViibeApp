/**
 * BookingModal — "Reserve a table at [Venue]"
 * ₦500 reservation fee via Paystack. OpenTable model for Viibe.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const PARTY_SIZES = Array.from({ length: 20 }, (_, i) => i + 1);

interface Props {
  visible: boolean;
  onClose: () => void;
  venueId: string;
  venueName: string;
  authToken: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  isDemoMode?: boolean;
}

type Step = 'form' | 'payment' | 'success';

export default function BookingModal({
  visible, onClose, venueId, venueName,
  authToken, userName = '', userPhone = '', userEmail = '',
  isDemoMode = false,
}: Props) {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState(userPhone);
  const [email, setEmail] = useState(userEmail);
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('22:00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [reference, setReference] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [error, setError] = useState('');

  const canSubmit = name.trim() && phone.trim() && email.trim() && date.trim();

  const handleInitialize = async () => {
    setError('');
    setLoading(true);

    if (isDemoMode) {
      // Demo: skip payment, go straight to success
      setStep('success');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/bookings/initialize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: name.trim(),
          user_phone: phone.trim(),
          party_size: partySize,
          booking_date: date.trim(),
          booking_time: time.trim(),
          notes: notes.trim(),
          email: email.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.detail || 'Could not initialize booking'); return; }

      setBookingId(json.booking_id);
      setReference(json.reference);
      setPaymentUrl(json.authorization_url);
      setStep('payment');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentNav = async (navUrl: string) => {
    // Paystack redirects to callback_url after payment
    if (navUrl.includes('viibe://booking/confirm/') || navUrl.includes('/booking/confirm/')) {
      // Always use the reference we initiated — never trust the one from the URL
      // (prevents deep-link injection where a malicious URL swaps the reference)
      const ref = reference;
      // Verify payment
      try {
        const res = await fetch(`${API_URL}/api/bookings/verify/${ref}`, { method: 'POST' });
        if (res.ok) setStep('success');
        else setError('Payment verification failed. Please contact support.');
      } catch { setError('Could not verify payment. Please contact support.'); }
    }
  };

  const handleClose = () => {
    setStep('form');
    setError('');
    setPaymentUrl('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {step === 'success' ? 'Booking Confirmed!' : `Reserve at ${venueName}`}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          </View>

          {/* FORM STEP */}
          {step === 'form' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.feeNote}>
                <Ionicons name="card-outline" size={14} color="#FF9933" />
                <Text style={styles.feeText}>₦500 reservation fee · Refundable 24h before</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>YOUR NAME</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#444" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>PHONE</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234..." placeholderTextColor="#444" keyboardType="phone-pad" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>EMAIL (for receipt)</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor="#444" keyboardType="email-address" autoCapitalize="none" />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>DATE</Text>
                  <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#444" />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>TIME</Text>
                  <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="22:00" placeholderTextColor="#444" />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>PARTY SIZE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {[1,2,3,4,5,6,8,10,15,20].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.sizeChip, partySize === n && styles.sizeChipActive]}
                      onPress={() => setPartySize(n)}
                    >
                      <Text style={[styles.sizeText, partySize === n && { color: '#FFF' }]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>NOTES (optional)</Text>
                <TextInput style={[styles.input, { height: 60 }]} value={notes} onChangeText={setNotes} placeholder="Birthday, VIP section..." placeholderTextColor="#444" multiline />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
                onPress={handleInitialize}
                disabled={loading || !canSubmit}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.confirmBtnText}>Reserve · Pay ₦500</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* PAYMENT STEP */}
          {step === 'payment' && paymentUrl ? (
            <View style={{ flex: 1, minHeight: 420 }}>
              <WebView
                source={{ uri: paymentUrl }}
                onNavigationStateChange={(nav) => handlePaymentNav(nav.url)}
                style={{ flex: 1, borderRadius: 12 }}
              />
            </View>
          ) : null}

          {/* SUCCESS STEP */}
          {step === 'success' && (
            <View style={styles.successView}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />
              </View>
              <Text style={styles.successTitle}>You're booked!</Text>
              <Text style={styles.successSub}>
                {partySize} {partySize === 1 ? 'guest' : 'guests'} at {venueName}
              </Text>
              <Text style={styles.successDate}>{date} · {time}</Text>
              <Text style={styles.successNote}>Show this confirmation at the venue.</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  feeNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF993315', borderRadius: 8, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: '#FF993330' },
  feeText: { fontSize: 12, color: '#FF9933', fontWeight: '600' },
  formGroup: { marginBottom: 14, gap: 5 },
  formRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 9, fontWeight: '800', color: '#555', letterSpacing: 1.5 },
  input: { backgroundColor: '#0D0D14', borderWidth: 1, borderColor: '#252530', borderRadius: 10, padding: 12, color: '#FFF', fontSize: 14 },
  sizeChip: { backgroundColor: '#1A1A25', borderRadius: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1, borderColor: '#252530' },
  sizeChipActive: { backgroundColor: '#FF3366', borderColor: '#FF3366' },
  sizeText: { fontSize: 13, fontWeight: '700', color: '#888' },
  errorText: { color: '#FF5252', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  confirmBtn: { backgroundColor: '#FF3366', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  successView: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  successIcon: { marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  successSub: { fontSize: 14, color: '#AAA' },
  successDate: { fontSize: 14, color: '#FF3366', fontWeight: '700' },
  successNote: { fontSize: 11, color: '#555', marginTop: 8 },
  doneBtn: { backgroundColor: '#4CAF50', borderRadius: 12, paddingHorizontal: 40, paddingVertical: 14, marginTop: 16 },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
