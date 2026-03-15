/**
 * VibeMarket — Real-time venue leaderboard styled like a live stock exchange.
 *
 * Features:
 *  - Scrolling ticker tape (NYSE-style) of top venue scores
 *  - Per-venue sparkline (10-bar mini chart) showing simulated history
 *  - Per-venue % change from session open
 *  - Live score simulation — scores drift up/down every few seconds
 *  - Fullscreen market board modal
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Modal, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VibeMarketVenue {
  id: string;
  name: string;
  area: string;
  current_vibe_score: number;
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  energy_level?: string;
  pulse_count: number;
  pulse_tier: string;
  is_featured?: boolean;
}

interface Props {
  venues: VibeMarketVenue[];
  cityName: string;
  cityScore?: number;
  cityLabel?: string;
  onVenuePress: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#FF3366';
  if (score >= 60) return '#FF9933';
  if (score >= 40) return '#9933FF';
  return '#3399FF';
}

function venueVibeLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'ELECTRIC', color: '#FF3366' };
  if (score >= 60) return { label: 'POPPING',  color: '#FF9933' };
  if (score >= 40) return { label: 'BUZZING',  color: '#9933FF' };
  return              { label: 'SLOW BURN', color: '#3399FF' };
}

function liveTime(): string {
  return new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

// Clamp between 10–100
function clamp(v: number) { return Math.max(10, Math.min(100, v)); }

// ─── Ticker Tape ──────────────────────────────────────────────────────────────

function TickerTape({ items }: { items: Array<{ name: string; score: number; change: number }> }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const contentWidth = useRef(0);

  useEffect(() => {
    if (contentWidth.current === 0) return;
    Animated.loop(
      Animated.timing(scrollX, {
        toValue: -contentWidth.current / 2,
        duration: contentWidth.current * 28,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [contentWidth.current]);

  const label = items.map(item => {
    const arrow = item.change >= 0 ? '▲' : '▼';
    const col = item.change >= 0 ? '#00E676' : '#FF5252';
    return { ...item, arrow, col };
  });

  // Duplicate for seamless loop
  const doubled = [...label, ...label];

  return (
    <View style={tickSt.wrap}>
      <LinearGradient colors={['#0E0E16', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tickSt.fadeLeft} pointerEvents="none" />
      <LinearGradient colors={['transparent', '#0E0E16']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tickSt.fadeRight} pointerEvents="none" />
      <Animated.View
        style={{ flexDirection: 'row', transform: [{ translateX: scrollX }] }}
        onLayout={e => { contentWidth.current = e.nativeEvent.layout.width; }}
      >
        {doubled.map((item, i) => (
          <View key={i} style={tickSt.item}>
            <Text style={tickSt.name} numberOfLines={1}>{item.name.toUpperCase().slice(0, 12)}</Text>
            <Text style={[tickSt.score, { color: scoreColor(item.score) }]}>{item.score}</Text>
            <Text style={[tickSt.change, { color: item.col }]}>{item.arrow}{Math.abs(item.change)}%</Text>
            <View style={tickSt.dot} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const tickSt = StyleSheet.create({
  wrap: { height: 26, overflow: 'hidden', backgroundColor: '#09090F', borderBottomWidth: 1, borderBottomColor: '#1A1A24' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  name: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  score: { fontSize: 10, fontWeight: '900' },
  change: { fontSize: 9, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#2A2A38' },
  fadeLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, zIndex: 1 },
  fadeRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, zIndex: 1 },
});

// ─── Flash Animation ──────────────────────────────────────────────────────────

function useFlashColor(current: number, prev: number) {
  const flash = useRef(new Animated.Value(0)).current;
  const isUp = current > prev;
  const isDown = current < prev;

  useEffect(() => {
    if (current === prev) return;
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 800, useNativeDriver: false }).start();
  }, [current]);

  const bg = flash.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', isUp ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)'],
  });
  return bg;
}

// ─── Venue Row ────────────────────────────────────────────────────────────────

function VenueRow({
  venue, rank, delay, onPress, big = false, liveScore, change,
}: {
  venue: VibeMarketVenue; rank: number; delay: number; onPress: () => void;
  big?: boolean; liveScore: number; change: number;
}) {
  const prevScore = useRef(liveScore);
  const slideAnim = useRef(new Animated.Value(big ? 0 : 16)).current;
  const fadeAnim  = useRef(new Animated.Value(big ? 1 : 0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const flashBg   = useFlashColor(liveScore, prevScore.current);

  useEffect(() => { prevScore.current = liveScore; }, [liveScore]);

  const sColor = scoreColor(liveScore);
  const vl     = venueVibeLabel(liveScore);
  const isUp   = change >= 0;

  useEffect(() => {
    if (big) return;
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (rank !== 0) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(2800),
      Animated.timing(blinkAnim, { toValue: 0.2, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 0.2, duration: 100, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [rank]);

  return (
    <Animated.View style={[{ overflow: 'hidden' }, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}>
      <Animated.View style={{ backgroundColor: flashBg }}>
        <TouchableOpacity style={[rowSt.row, big && rowSt.rowBig]} onPress={onPress} activeOpacity={0.7}>
          {/* Rank */}
          <Text style={[rowSt.rank, rank === 0 && { color: '#FFD700' }]}>#{rank + 1}</Text>

          {/* Name + area + label */}
          <View style={rowSt.nameCol}>
            <View style={rowSt.nameRow}>
              <Text style={[rowSt.name, big && { fontSize: 15 }]} numberOfLines={1}>{venue.name}</Text>
              {venue.is_featured && (
                <View style={rowSt.featuredBadge}><Text style={rowSt.featuredText}>★ TOP</Text></View>
              )}
            </View>
            <Text style={rowSt.area} numberOfLines={1}>
              {venue.area}
              <Text style={{ color: vl.color, fontWeight: '800', fontSize: 8 }}> · {vl.label}</Text>
            </Text>
          </View>

          {/* Score + change */}
          <View style={rowSt.priceCol}>
            <Animated.Text style={[rowSt.price, { color: sColor, opacity: rank === 0 ? blinkAnim : 1 }, big && { fontSize: 24 }]}>
              {Math.round(liveScore)}
            </Animated.Text>
            <Text style={[rowSt.change, { color: isUp ? '#00E676' : '#FF5252' }]}>
              {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
      <View style={rowSt.divider} />
    </Animated.View>
  );
}

const rowSt = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  rowBig: { paddingVertical: 14 },
  rank:   { fontSize: 11, fontWeight: '800', color: '#555', width: 24, letterSpacing: -0.3 },
  nameCol:{ flex: 1, minWidth: 0 },
  nameRow:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  name:   { fontSize: 13, fontWeight: '700', color: '#EEE', marginBottom: 1, flexShrink: 1 },
  featuredBadge: { backgroundColor: '#FFD70020', borderWidth: 1, borderColor: '#FFD70055', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  featuredText:  { fontSize: 7, fontWeight: '900', color: '#FFD700', letterSpacing: 0.5 },
  area:   { fontSize: 10, color: '#444' },
  priceCol: { alignItems: 'flex-end', gap: 2, width: 52 },
  price:  { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, textAlign: 'right' },
  change: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  divider:{ height: 1, backgroundColor: '#1A1A24', marginHorizontal: 14 },
});

// ─── Index Header ─────────────────────────────────────────────────────────────

function IndexHeader({
  cityName, cityScore, cityLabel, venueCount, onExpand, showExpand = false, indexChange,
}: {
  cityName: string; cityScore: number; cityLabel: string; venueCount: number;
  onExpand?: () => void; showExpand?: boolean; indexChange: string;
}) {
  const [time, setTime] = useState(liveTime());
  const dotAnim = useRef(new Animated.Value(1)).current;
  const isPositive = !indexChange.startsWith('-');

  const statusColor =
    cityLabel === 'ELECTRIC' ? '#FF3366' :
    cityLabel === 'POPPING'  ? '#FF9933' :
    cityLabel === 'BUZZING'  ? '#9933FF' : '#3399FF';

  const nowDay  = new Date().getDay();
  const nowHour = new Date().getHours();
  const isWeekend = (nowDay === 5 && nowHour >= 18) || nowDay === 6;
  const weekendTag = nowDay === 5 ? 'FRI NIGHT' : 'WEEKEND';

  useEffect(() => {
    const i = setInterval(() => setTime(liveTime()), 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <LinearGradient colors={['#0E0E16', '#111118']} style={idxSt.card}>
      <View style={idxSt.topRow}>
        <View style={idxSt.liveRow}>
          <Animated.View style={[idxSt.liveDot, { opacity: dotAnim }]} />
          <Text style={idxSt.liveText}>LIVE</Text>
          <Text style={idxSt.exchange}>VIBE EXCHANGE</Text>
          {isWeekend && (
            <View style={idxSt.weekendChip}>
              <Text style={idxSt.weekendChipText}>🎉 {weekendTag}</Text>
            </View>
          )}
        </View>
        <View style={idxSt.timeRow}>
          <Text style={idxSt.timeText}>{time}</Text>
          <View style={[idxSt.marketBadge, { borderColor: statusColor + '50' }]}>
            <View style={[idxSt.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[idxSt.marketLabel, { color: statusColor }]}>{cityLabel}</Text>
          </View>
          {showExpand && onExpand && (
            <TouchableOpacity style={idxSt.expandBtn} onPress={onExpand} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="expand-outline" size={15} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={idxSt.indexRow}>
        <View>
          <Text style={idxSt.indexScore}>
            {cityScore}
            <Text style={idxSt.indexUnit}> pts</Text>
          </Text>
          <Text style={idxSt.cityLabel}>{cityName.toUpperCase()} · {venueCount} ACTIVE</Text>
        </View>
        <View style={idxSt.changeBlock}>
          <Text style={[idxSt.indexChange, { color: isPositive ? '#00E676' : '#FF5252' }]}>
            {isPositive ? '▲' : '▼'} {indexChange.replace('-', '')}
          </Text>
          <Text style={idxSt.changeSubtext}>tonight</Text>
        </View>
      </View>

      <View style={idxSt.colHeaders}>
        <Text style={[idxSt.colLabel, { flex: 1, marginLeft: 32 }]}>VENUE</Text>
        <Text style={[idxSt.colLabel, { width: 52, textAlign: 'right' }]}>SCORE</Text>
      </View>
    </LinearGradient>
  );
}

const idxSt = StyleSheet.create({
  card: { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, borderWidth: 1, borderColor: '#1E1E2A', borderBottomWidth: 0 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676' },
  liveText: { fontSize: 9, fontWeight: '900', color: '#00E676', letterSpacing: 1.5 },
  exchange: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700', letterSpacing: 1.5, marginLeft: 4 },
  weekendChip: { backgroundColor: '#FF336618', borderWidth: 1, borderColor: '#FF336640', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  weekendChipText: { fontSize: 8, fontWeight: '800', color: '#FF9933', letterSpacing: 0.5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { fontSize: 10, color: '#666', fontWeight: '600', letterSpacing: 0.5 },
  marketBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  marketLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  expandBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center' },
  indexRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  indexScore: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  indexUnit: { fontSize: 14, color: '#555', fontWeight: '500' },
  cityLabel: { fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },
  changeBlock: { alignItems: 'flex-end' },
  indexChange: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  changeSubtext: { fontSize: 9, color: '#444', marginTop: 2 },
  colHeaders: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#1A1A24', gap: 8 },
  colLabel: { fontSize: 8, color: '#444', fontWeight: '700', letterSpacing: 1 },
});

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function VibeMarket({ venues, cityName, cityScore = 50, cityLabel = 'BUZZING', onVenuePress }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const insets = useSafeAreaInsets();

  // Live simulated scores — drift slightly every 4s
  const [liveScores, setLiveScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(venues.map(v => [v.id, v.current_vibe_score]))
  );
  const [openScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(venues.map(v => [v.id, v.current_vibe_score]))
  );

  // Simulate live price movement
  useEffect(() => {
    if (venues.length === 0) return;
    const interval = setInterval(() => {
      setLiveScores(prev => {
        const next = { ...prev };
        venues.forEach(v => {
          const velocity = v.vibe_velocity;
          const bias = velocity === 'heating_up' ? 1.2 : velocity === 'cooling_down' ? -1.2 : 0;
          const drift = (Math.random() * 4 - 2) + bias;
          next[v.id] = clamp(Math.round((prev[v.id] ?? v.current_vibe_score) + drift));
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [venues]);

  if (!venues || venues.length === 0) return null;

  const sorted = [...venues].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (liveScores[b.id] ?? b.current_vibe_score) - (liveScores[a.id] ?? a.current_vibe_score);
  });

  const liveCityScore = Math.round(
    sorted.slice(0, 5).reduce((s, v) => s + (liveScores[v.id] ?? v.current_vibe_score), 0) / Math.min(5, sorted.length)
  );

  const indexChange =
    cityLabel === 'ELECTRIC' ? '+12.4%' :
    cityLabel === 'POPPING'  ? '+6.8%'  :
    cityLabel === 'BUZZING'  ? '+2.1%'  : '-3.4%';

  const tickerItems = sorted.slice(0, 8).map(v => {
    const live = liveScores[v.id] ?? v.current_vibe_score;
    const open = openScores[v.id] ?? v.current_vibe_score;
    const change = open > 0 ? Math.round(((live - open) / open) * 100 * 10) / 10 : 0;
    return { name: v.name, score: live, change };
  });

  const getChange = (v: VibeMarketVenue) => {
    const live = liveScores[v.id] ?? v.current_vibe_score;
    const open = openScores[v.id] ?? v.current_vibe_score;
    return open > 0 ? Math.round(((live - open) / open) * 100 * 10) / 10 : 0;
  };

  return (
    <>
      <View style={styles.container}>
        <TickerTape items={tickerItems} />
        <IndexHeader
          cityName={cityName}
          cityScore={liveCityScore}
          cityLabel={cityLabel.toUpperCase()}
          venueCount={venues.length}
          showExpand
          onExpand={() => setFullscreen(true)}
          indexChange={indexChange}
        />
        <View style={styles.board}>
          {sorted.map((venue, i) => (
            <VenueRow
              key={venue.id}
              venue={venue}
              rank={i}
              delay={i * 60}
              liveScore={liveScores[venue.id] ?? venue.current_vibe_score}
              change={getChange(venue)}
              onPress={() => onVenuePress(venue.id)}
            />
          ))}
          <View style={styles.footer}>
            <Text style={styles.footerText}>VIBE EXCHANGE · RANKINGS RESET 6AM · DATA LIVE</Text>
            <Text style={styles.footerText}>◈</Text>
          </View>
        </View>
      </View>

      {/* Fullscreen Modal */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setFullscreen(false)}>
        <View style={[fs.container, { paddingTop: insets.top }]}>
          <StatusBar barStyle="light-content" />
          <View style={{ flex: 1 }}>
            <View style={fs.header}>
              <View style={fs.headerLeft}>
                <Ionicons name="bar-chart" size={18} color="#00E676" />
                <Text style={fs.title}>VIBE EXCHANGE</Text>
                <Text style={fs.cityChip}>{cityName.toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              <View style={fs.tickerWrap}>
                <TickerTape items={tickerItems} />
              </View>
              <View style={fs.indexWrap}>
                <IndexHeader
                  cityName={cityName}
                  cityScore={liveCityScore}
                  cityLabel={cityLabel.toUpperCase()}
                  venueCount={venues.length}
                  indexChange={indexChange}
                />
              </View>
              <View style={fs.board}>
                {sorted.map((venue, i) => (
                  <VenueRow
                    key={venue.id}
                    venue={venue}
                    rank={i}
                    delay={0}
                    big
                    liveScore={liveScores[venue.id] ?? venue.current_vibe_score}
                    change={getChange(venue)}
                    onPress={() => { setFullscreen(false); onVenuePress(venue.id); }}
                  />
                ))}
              </View>

              {/* Market stats */}
              <View style={fs.statsRow}>
                <View style={fs.statBlock}>
                  <Text style={fs.statValue}>{sorted.filter(v => v.vibe_velocity === 'heating_up').length}</Text>
                  <Text style={[fs.statLabel, { color: '#00E676' }]}>▲ HEATING</Text>
                </View>
                <View style={fs.statBlock}>
                  <Text style={fs.statValue}>{sorted.filter(v => v.vibe_velocity === 'stable').length}</Text>
                  <Text style={[fs.statLabel, { color: '#9933FF' }]}>— STABLE</Text>
                </View>
                <View style={fs.statBlock}>
                  <Text style={fs.statValue}>{sorted.filter(v => v.vibe_velocity === 'cooling_down').length}</Text>
                  <Text style={[fs.statLabel, { color: '#FF5252' }]}>▼ COOLING</Text>
                </View>
                <View style={fs.statBlock}>
                  <Text style={fs.statValue}>{sorted.reduce((s, v) => s + v.pulse_count, 0)}</Text>
                  <Text style={[fs.statLabel, { color: '#FFD700' }]}>PULSE</Text>
                </View>
              </View>

              <View style={fs.footer}>
                <Text style={fs.footerText}>VIBE EXCHANGE · RANKINGS RESET 6AM · DATA LIVE · ◈</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#1E1E2A' },
  board: { backgroundColor: '#0B0B12', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1A1A24' },
  footerText: { fontSize: 7, color: '#2A2A38', fontWeight: '700', letterSpacing: 1 },
});

const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  cityChip: { fontSize: 9, color: '#666', fontWeight: '700', letterSpacing: 2, backgroundColor: '#1A1A28', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 32 },
  tickerWrap: { marginBottom: 0 },
  indexWrap: { margin: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#1E1E2A' },
  board: { backgroundColor: '#0B0B12', marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1A1A24', marginBottom: 16 },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, borderWidth: 1, borderColor: '#1A1A28', padding: 16 },
  statBlock: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  statLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  footer: { marginHorizontal: 16, alignItems: 'center', paddingVertical: 8 },
  footerText: { fontSize: 8, color: '#2A2A38', fontWeight: '700', letterSpacing: 1 },
});
