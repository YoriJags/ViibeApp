/**
 * BookingsCard — Merchant view of upcoming reservations.
 * "3 bookings today · 7 guests incoming"
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Booking {
  id: string;
  user_name: string;
  user_phone: string;
  party_size: number;
  booking_date: string;
  booking_time: string;
  notes?: string;
  status: string;
  confirmed_at?: string;
}

interface BookingsSummary {
  today_count: number;
  total_guests_today: number;
  upcoming_count: number;
}

interface BookingsData {
  bookings: Booking[];
  summary: BookingsSummary;
}

interface Props {
  venueId: string;
  authToken: string;
  demoData?: BookingsData;
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function BookingsCard({ venueId, authToken, demoData }: Props) {
  const [data, setData] = useState<BookingsData | null>(demoData ?? null);
  const [loading, setLoading] = useState(!demoData);
  const [expanded, setExpanded] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (demoData) return;
    try {
      const res = await fetch(`${API_URL}/api/merchant/venues/${venueId}/bookings`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [venueId, authToken, demoData]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  if (loading) return <View style={styles.loading}><ActivityIndicator size="small" color="#FF3366" /></View>;
  if (!data) return null;

  const { summary, bookings } = data;

  // Group by date for display
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter(b => b.booking_date === todayStr);
  const upcomingBookings = bookings.filter(b => b.booking_date > todayStr);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>RESERVATIONS</Text>
          <Text style={styles.subtitle}>Upcoming table bookings</Text>
        </View>
        <View style={styles.headerRight}>
          {summary.today_count > 0 && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>{summary.today_count} today</Text>
            </View>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#555" />
        </View>
      </TouchableOpacity>

      {/* Summary strip — always visible */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.today_count}</Text>
          <Text style={styles.summaryLabel}>Today</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#FF9933' }]}>{summary.total_guests_today}</Text>
          <Text style={styles.summaryLabel}>Guests today</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.upcoming_count}</Text>
          <Text style={styles.summaryLabel}>Total upcoming</Text>
        </View>
      </View>

      {/* Booking list */}
      {expanded && (
        <View style={styles.list}>
          {bookings.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming bookings yet.</Text>
          ) : (
            <>
              {todayBookings.length > 0 && (
                <>
                  <Text style={styles.dateGroup}>TODAY</Text>
                  {todayBookings.map(b => <BookingRow key={b.id} booking={b} />)}
                </>
              )}
              {upcomingBookings.length > 0 && (
                <>
                  <Text style={[styles.dateGroup, { marginTop: 12 }]}>UPCOMING</Text>
                  {upcomingBookings.map(b => <BookingRow key={b.id} booking={b} />)}
                </>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  return (
    <View style={styles.bookingRow}>
      <View style={styles.bookingTime}>
        <Text style={styles.bookingTimeText}>{formatTime(booking.booking_time)}</Text>
        <Text style={styles.bookingDateText}>{formatDate(booking.booking_date)}</Text>
      </View>
      <View style={styles.bookingInfo}>
        <Text style={styles.bookingName}>{booking.user_name}</Text>
        {booking.notes ? <Text style={styles.bookingNotes} numberOfLines={1}>{booking.notes}</Text> : null}
      </View>
      <View style={styles.bookingGuests}>
        <Ionicons name="people" size={13} color="#888" />
        <Text style={styles.bookingGuestCount}>{booking.party_size}</Text>
      </View>
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
  loading: { padding: 20, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: { gap: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 10, fontWeight: '800', color: '#FF3366', letterSpacing: 2 },
  subtitle: { fontSize: 11, color: '#555', marginTop: 2 },
  todayBadge: {
    backgroundColor: '#FF336620',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FF336640',
  },
  todayBadgeText: { fontSize: 11, fontWeight: '700', color: '#FF3366' },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#252530',
    backgroundColor: '#0D0D14',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  summaryLabel: { fontSize: 9, color: '#555', fontWeight: '600', letterSpacing: 0.5 },
  divider: { width: 1, height: 28, backgroundColor: '#252530' },
  list: { padding: 12, gap: 6 },
  emptyText: { fontSize: 12, color: '#444', textAlign: 'center', padding: 16 },
  dateGroup: { fontSize: 9, fontWeight: '800', color: '#444', letterSpacing: 1.5, marginBottom: 4 },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E1E2A',
    padding: 12,
    gap: 10,
  },
  bookingTime: { alignItems: 'center', minWidth: 56 },
  bookingTimeText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  bookingDateText: { fontSize: 9, color: '#555', marginTop: 2 },
  bookingInfo: { flex: 1, gap: 2 },
  bookingName: { fontSize: 13, fontWeight: '700', color: '#DDD' },
  bookingNotes: { fontSize: 10, color: '#555' },
  bookingGuests: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookingGuestCount: { fontSize: 14, fontWeight: '800', color: '#888' },
});
