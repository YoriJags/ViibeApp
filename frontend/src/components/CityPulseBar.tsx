/**
 * CityPulseBar — Compact city heartbeat bar for the home screen.
 * Shows: city name · live score · trend · 30-min sparkline · scout/venue counts.
 * Tap expands to fullscreen city pulse dashboard.
 * Updates via Socket.IO city_pulse_update event (handled in vibeStore).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Modal, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CityPulseData } from '../store/vibeStore';

const LABEL_COLORS: Record<string, string> = {
  PEAK:    '#FF3366',
  LIT:     '#FF9933',
  WARMING: '#9B59B6',
  CHILL:   '#3399FF',
  QUIET:   '#555E6E',
};

const TREND_ICON: Record<string, string> = {
  heating_up:   '↑',
  cooling_down: '↓',
  stable:       '→',
};

const TREND_LABEL: Record<string, string> = {
  heating_up:   'heating up',
  cooling_down: 'cooling down',
  stable:       'stable',
};

const TREND_COLOR: Record<string, string> = {
  heating_up:   '#00E676',
  cooling_down: '#FF5252',
  stable:       '#9933FF',
};

interface CityPulseBarProps {
  pulse: CityPulseData;
  onPress?: () => void;
}

// ── Spark bars shared ──────────────────────────────────────────────────────────
function Sparkline({ sparkline, color, big = false }: { sparkline: number[]; color: string; big?: boolean }) {
  const maxSpark = Math.max(...sparkline, 1);
  return (
    <View style={[sparkSt.wrap, big && { height: 56, gap: 4 }]}>
      {sparkline.map((val, i) => (
        <View
          key={i}
          style={[
            sparkSt.bar,
            big && { width: 10, borderRadius: 4 },
            {
              height: Math.max(3, (val / maxSpark) * (big ? 56 : 28)),
              backgroundColor: i === sparkline.length - 1 ? color : `${color}60`,
            },
          ]}
        />
      ))}
    </View>
  );
}

const sparkSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 32 },
  bar: { width: 6, borderRadius: 3 },
});

// ── Main component ─────────────────────────────────────────────────────────────
export default function CityPulseBar({ pulse, onPress }: CityPulseBarProps) {
  const pulseAnim    = useRef(new Animated.Value(0.7)).current;
  const dotAnim      = useRef(new Animated.Value(1)).current;
  const scoutsScale  = useRef(new Animated.Value(1)).current;
  const venuesScale  = useRef(new Animated.Value(1)).current;
  const [fullscreen, setFullscreen] = useState(false);

  const color = LABEL_COLORS[pulse.pulse_label] ?? LABEL_COLORS.CHILL;
  const trendColor = TREND_COLOR[pulse.trend] ?? '#9933FF';

  useEffect(() => {
    if (pulse.pulse_score >= 65) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulse.pulse_score]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scoutsScale, { toValue: 1.15, duration: 150, useNativeDriver: true }),
      Animated.timing(scoutsScale, { toValue: 1,    duration: 150, useNativeDriver: true }),
    ]).start();
  }, [pulse.active_scouts]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(venuesScale, { toValue: 1.15, duration: 150, useNativeDriver: true }),
      Animated.timing(venuesScale, { toValue: 1,    duration: 150, useNativeDriver: true }),
    ]).start();
  }, [pulse.hot_venues]);

  const cityName   = pulse.city.charAt(0).toUpperCase() + pulse.city.slice(1);
  const sparkline  = pulse.sparkline ?? [];

  const handlePress = () => {
    setFullscreen(true);
    onPress?.();
  };

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.wrapper}>
        <LinearGradient
          colors={[`${color}18`, `${color}06`]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.card, { borderColor: `${color}30` }]}
        >
          {/* Left: city + score */}
          <View style={styles.left}>
            <Text style={styles.cityName}>{cityName.toUpperCase()}</Text>
            <View style={styles.scoreRow}>
              <Animated.Text style={[styles.score, { color, opacity: pulseAnim }]}>
                {pulse.pulse_score}
              </Animated.Text>
              <Text style={[styles.label, { color }]}>{pulse.pulse_label}</Text>
              <Text style={[styles.trend, { color }]}>
                {TREND_ICON[pulse.trend]} {TREND_LABEL[pulse.trend]}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Animated.Text style={[styles.sub, { transform: [{ scale: scoutsScale }] }]}>
                {pulse.active_scouts}
              </Animated.Text>
              <Text style={styles.sub}>{' scouts · '}</Text>
              <Animated.Text style={[styles.sub, { transform: [{ scale: venuesScale }] }]}>
                {pulse.hot_venues ?? 0}
              </Animated.Text>
              <Text style={styles.sub}>{' venues lit'}</Text>
            </View>
          </View>

          {/* Right: sparkline + expand hint */}
          <View style={styles.right}>
            <Sparkline sparkline={sparkline} color={color} />
            <View style={styles.rightBottom}>
              <Text style={styles.sparkLabel}>30 min</Text>
              <Ionicons name="expand-outline" size={13} color="#333" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Fullscreen Modal ──────────────────────────────────────────────────── */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <View style={fs.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={fs.header}>
              <View style={fs.headerLeft}>
                <Animated.View style={[fs.liveDot, { backgroundColor: color, opacity: dotAnim }]} />
                <Text style={fs.title}>CITY PULSE</Text>
                <Text style={[fs.cityChip, { color }]}>{cityName.toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              {/* Big score hero */}
              <LinearGradient colors={[`${color}18`, `${color}06`]} style={[fs.heroCard, { borderColor: color + '30' }]}>
                <View style={fs.heroLeft}>
                  <Animated.Text style={[fs.heroScore, { color, opacity: pulseAnim }]}>
                    {pulse.pulse_score}
                  </Animated.Text>
                  <Text style={[fs.heroLabel, { color }]}>{pulse.pulse_label}</Text>
                </View>
                <View style={fs.heroRight}>
                  <View style={[fs.trendChip, { backgroundColor: trendColor + '18', borderColor: trendColor + '40' }]}>
                    <Text style={[fs.trendIcon, { color: trendColor }]}>{TREND_ICON[pulse.trend]}</Text>
                    <Text style={[fs.trendLabel, { color: trendColor }]}>{TREND_LABEL[pulse.trend]}</Text>
                  </View>
                  <Sparkline sparkline={sparkline} color={color} big />
                  <Text style={fs.sparkLabel}>30 min activity</Text>
                </View>
              </LinearGradient>

              {/* Stat grid */}
              <View style={fs.statsGrid}>
                <View style={[fs.statCard, { borderColor: '#FF336640' }]}>
                  <Ionicons name="people" size={18} color="#FF3366" />
                  <Text style={[fs.statNum, { color: '#FF3366' }]}>{pulse.active_scouts}</Text>
                  <Text style={fs.statLabel}>ACTIVE SCOUTS</Text>
                </View>
                <View style={[fs.statCard, { borderColor: '#FF993340' }]}>
                  <Ionicons name="flame" size={18} color="#FF9933" />
                  <Text style={[fs.statNum, { color: '#FF9933' }]}>{pulse.hot_venues ?? 0}</Text>
                  <Text style={fs.statLabel}>VENUES LIT</Text>
                </View>
                <View style={[fs.statCard, { borderColor: color + '40' }]}>
                  <Ionicons name="flash" size={18} color={color} />
                  <Text style={[fs.statNum, { color }]}>{pulse.pulse_score}</Text>
                  <Text style={fs.statLabel}>CITY SCORE</Text>
                </View>
              </View>

              {/* Spark history — larger */}
              <View style={fs.section}>
                <View style={fs.sectionHeaderRow}>
                  <Text style={fs.sectionLabel}>30-MINUTE PULSE</Text>
                  <Text style={fs.sectionSub}>Real-time activity feed</Text>
                </View>
                <View style={fs.bigSparkWrap}>
                  <Sparkline sparkline={sparkline} color={color} big />
                </View>
              </View>

              {/* City mood description */}
              <View style={fs.moodCard}>
                <View style={[fs.moodDot, { backgroundColor: color }]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[fs.moodTitle, { color }]}>
                    {pulse.pulse_label === 'PEAK'    ? 'Lagos is PEAKING right now' :
                     pulse.pulse_label === 'LIT'     ? 'The city is fully lit tonight' :
                     pulse.pulse_label === 'WARMING' ? 'The scene is warming up' :
                     pulse.pulse_label === 'CHILL'   ? 'Chill night — select spots active' :
                     'Quiet right now — early hours'}
                  </Text>
                  <Text style={fs.moodDesc}>
                    {pulse.trend === 'heating_up'   ? 'Scouts are pouring in — energy is climbing fast.' :
                     pulse.trend === 'cooling_down' ? 'Activity slowing. Peak may have passed for tonight.' :
                     'Steady crowd. Consistent energy across the city.'}
                  </Text>
                </View>
              </View>

              <View style={fs.footer}>
                <Animated.View style={[fs.footerDot, { backgroundColor: color, opacity: dotAnim }]} />
                <Text style={fs.footerText}>LIVE · Updates every 30s via VIIBE scouts on ground</Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  left: { flex: 1, gap: 3 },
  cityName: { fontSize: 10, fontWeight: '800', color: '#555', letterSpacing: 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  score: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  trend: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  sub: { fontSize: 11, color: '#666', letterSpacing: 0.3 },
  right: { alignItems: 'flex-end', gap: 4 },
  rightBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sparkLabel: { fontSize: 9, color: '#444', letterSpacing: 0.5 },
});

const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  cityChip: { fontSize: 9, fontWeight: '800', letterSpacing: 2, backgroundColor: '#1A1A28', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 48 },
  heroCard: { flexDirection: 'row', alignItems: 'center', margin: 16, borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  heroLeft: { gap: 4 },
  heroScore: { fontSize: 64, fontWeight: '900', letterSpacing: -3, lineHeight: 66 },
  heroLabel: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  heroRight: { flex: 1, alignItems: 'flex-end', gap: 8 },
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  trendIcon: { fontSize: 14, fontWeight: '900' },
  trendLabel: { fontSize: 11, fontWeight: '700' },
  sparkLabel: { fontSize: 9, color: '#444', letterSpacing: 1 },
  statsGrid: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  statNum: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  statLabel: { fontSize: 8, color: '#555', fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 2 },
  sectionSub: { fontSize: 9, color: '#333' },
  bigSparkWrap: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'flex-end' },
  moodCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: '#1A1A28', padding: 16, marginBottom: 16 },
  moodDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  moodTitle: { fontSize: 15, fontWeight: '800' },
  moodDesc: { fontSize: 13, color: '#666', lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 8 },
  footerDot: { width: 6, height: 6, borderRadius: 3 },
  footerText: { fontSize: 9, color: '#333', fontWeight: '700', letterSpacing: 1 },
});
