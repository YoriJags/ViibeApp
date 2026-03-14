/**
 * VibeShareCard — exportable night recap card.
 *
 * Looks like a premium concert ticket / scene intel report.
 * Captured as PNG via react-native-view-shot, shared via expo-sharing.
 *
 * Every shared card carries the VIIBE wordmark and a download prompt —
 * it is the viral growth engine.
 *
 * Triggered from AfterHours → "SHARE YOUR NIGHT" button.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// react-native-view-shot and expo-sharing are native-only — guarded below
// Web users see a "not available" message instead of a broken build
import { Canvas, Path, Skia, Paint } from '@shopify/react-native-skia';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(340, SCREEN_W - 32);

// ─── DNA colors (mirrors VibeDynamicIsland) ───────────────────────────────────
const DNA_COLORS: Record<string, string> = {
  HIGH_VELOCITY:     '#FF5500',
  STEADY_GROOVE:     '#7700CC',
  ATMOSPHERIC_CHILL: '#00AACC',
};
const DNA_LABELS: Record<string, string> = {
  HIGH_VELOCITY:     'HIGH VELOCITY',
  STEADY_GROOVE:     'STEADY GROOVE',
  ATMOSPHERIC_CHILL: 'ATMOS CHILL',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareNightData {
  username:       string;
  scoutStatus?:   string;          // 'Scout', 'Elite Scout', etc.
  rank?:          number;
  auraLabel:      string;          // 'On Fire', 'Hot', etc.
  auraColor:      string;          // hex
  heatScore:      number;
  boltsTonight:   number;
  checkinsTonight: number;
  ratingsTonight: number;
  streakDays:     number;
  hotNights:      number;
  topVenueName?:  string;
  dnaSignature?:  string;
  sparkline:      number[];
  city:           string;
  date:           string;          // "Mar 14" etc.
  isDemoMode?:    boolean;
}

interface Props {
  data:     ShareNightData;
  visible:  boolean;
  onClose:  () => void;
}

// ─── Sparkline canvas (Skia) ──────────────────────────────────────────────────

function SparklineCanvas({ values, color }: { values: number[]; color: string }) {
  const W = 200, H = 36;
  if (!values || values.length < 2) return <View style={{ width: W, height: H }} />;

  const min = Math.min(...values);
  const max = Math.max(...values) || 1;
  const norm = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 6) - 3;
  const stepX = W / (values.length - 1);

  const path = Skia.Path.Make();
  // Area fill — bottom closed
  path.moveTo(0, H);
  values.forEach((v, i) => path.lineTo(i * stepX, norm(v)));
  path.lineTo((values.length - 1) * stepX, H);
  path.close();

  const linePath = Skia.Path.Make();
  values.forEach((v, i) => {
    if (i === 0) linePath.moveTo(0, norm(v));
    else linePath.lineTo(i * stepX, norm(v));
  });

  return (
    <Canvas style={{ width: W, height: H }}>
      <Path path={path} color={color + '28'} style="fill" />
      <Path path={linePath} style="stroke">
        <Paint style="stroke" strokeWidth={2} color={color} strokeCap="round" strokeJoin="round" />
      </Path>
    </Canvas>
  );
}

// ─── Card (the exportable view) ───────────────────────────────────────────────

const CardView = React.forwardRef<View, { data: ShareNightData }>(({ data }, ref) => {
  const dnaColor = data.dnaSignature ? DNA_COLORS[data.dnaSignature] : null;
  const accentColor = dnaColor ?? data.auraColor;

  return (
    <View ref={ref} style={[styles.card, { width: CARD_W }]} collapsable={false}>
      <LinearGradient
        colors={['#08081A', '#04040E', '#08081A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Glow wash behind hero */}
      <View style={[styles.glowWash, { shadowColor: data.auraColor }]} />

      {/* ── Top row ── */}
      <View style={styles.topRow}>
        <Text style={styles.brandMark}>VIIBE</Text>
        <Text style={styles.cityDate}>{data.city.toUpperCase()} · {data.date}</Text>
      </View>

      {/* ── Divider ── */}
      <View style={[styles.divider, { backgroundColor: accentColor + '33' }]} />

      {/* ── Hero: aura level ── */}
      <View style={styles.heroBlock}>
        <Text style={styles.heroSub}>HEAT LEVEL REACHED</Text>
        <Text style={[styles.heroLevel, { color: data.auraColor }]}>
          {data.auraLabel.toUpperCase()}
        </Text>
        <View style={styles.heroScoreRow}>
          <Text style={[styles.heroScore, { color: data.auraColor }]}>{data.heatScore}</Text>
          <Text style={styles.heroScoreUnit}>pts</Text>
          {data.hotNights > 0 && (
            <View style={[styles.hotNightsBadge, { borderColor: data.auraColor + '55' }]}>
              <Text style={[styles.hotNightsNum, { color: data.auraColor }]}>{data.hotNights}</Text>
              <Text style={styles.hotNightsLabel}>hot nights</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        {[
          { icon: 'flash',    val: data.boltsTonight,    label: 'BOLTS'   },
          { icon: 'location', val: data.checkinsTonight, label: 'SPOTS'   },
          { icon: 'star',     val: data.ratingsTonight,  label: 'RATINGS' },
          { icon: 'flame',    val: data.streakDays,      label: 'STREAK'  },
        ].map(({ icon, val, label }) => (
          <View key={label} style={styles.statCell}>
            <Ionicons name={icon as any} size={14} color={accentColor} />
            <Text style={styles.statVal}>{val}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── DNA chip + sparkline ── */}
      <View style={styles.dnaSparkRow}>
        {data.dnaSignature && DNA_LABELS[data.dnaSignature] && (
          <View style={[styles.dnaPill, { borderColor: accentColor + '55', backgroundColor: accentColor + '14' }]}>
            <Text style={[styles.dnaText, { color: accentColor }]}>
              {DNA_LABELS[data.dnaSignature]}
            </Text>
          </View>
        )}
        <View style={styles.sparkWrap}>
          <SparklineCanvas values={data.sparkline} color={accentColor} />
          <Text style={styles.sparkLabel}>CITY PULSE</Text>
        </View>
      </View>

      {/* ── Top venue ── */}
      {data.topVenueName && (
        <View style={[styles.topVenueRow, { borderColor: accentColor + '33' }]}>
          <Ionicons name="flash" size={11} color={accentColor} />
          <Text style={styles.topVenueLabel}>WHERE YOU LEFT YOUR MARK</Text>
          <Text style={[styles.topVenueName, { color: accentColor }]} numberOfLines={1}>
            {data.topVenueName}
          </Text>
        </View>
      )}

      {/* ── Scout rank ── */}
      {(data.rank || data.scoutStatus) && (
        <View style={styles.rankRow}>
          {data.rank && (
            <Text style={[styles.rankNum, { color: 'rgba(255,255,255,0.5)' }]}>#{data.rank}</Text>
          )}
          {data.scoutStatus && (
            <View style={[styles.scoutBadge, { borderColor: accentColor + '55' }]}>
              <Text style={[styles.scoutBadgeText, { color: accentColor }]}>
                {data.scoutStatus.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Footer ── */}
      <View style={[styles.footer, { borderTopColor: accentColor + '22' }]}>
        <Text style={styles.footerText}>viibe.app · join the scene</Text>
      </View>
    </View>
  );
});

// ─── Modal shell ──────────────────────────────────────────────────────────────

export default function VibeShareCard({ data, visible, onClose }: Props) {
  const cardRef  = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Share', 'Screenshot sharing is not available on web — use the mobile app.');
      return;
    }
    if (!cardRef.current) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Dynamic requires so the web bundle never tries to resolve these modules
      const { captureRef: _captureRef } = require('react-native-view-shot');
      const _Sharing = require('expo-sharing');
      const uri = await _captureRef(cardRef, { format: 'png', quality: 0.95 });
      const canShare = await _Sharing.isAvailableAsync();
      if (canShare) {
        await _Sharing.shareAsync(uri, {
          mimeType:    'image/png',
          dialogTitle: 'Share your VIIBE night',
          UTI:         'public.png',
        });
      }
    } catch {}
    setSharing(false);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>

        {/* Card preview */}
        <CardView ref={cardRef} data={data} />

        {/* Share button */}
        <TouchableOpacity
          style={[styles.shareBtn, { opacity: sharing ? 0.6 : 1 }]}
          onPress={handleShare}
          activeOpacity={0.8}
          disabled={sharing}
        >
          {sharing
            ? <ActivityIndicator color="#000" size="small" />
            : <>
                <Ionicons name="share-outline" size={18} color="#000" />
                <Text style={styles.shareBtnText}>SHARE YOUR NIGHT</Text>
              </>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>Your stats from tonight</Text>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  closeBtn: {
    position: 'absolute', top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Card itself ────────────────────────────────────────────
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A1A2E',
    overflow: 'hidden',
    padding: 20,
    gap: 14,
  },
  glowWash: {
    position: 'absolute',
    top: -30, alignSelf: 'center',
    width: 200, height: 200,
    borderRadius: 100,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 60,
    elevation: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandMark: {
    fontSize: 22, fontWeight: '900', color: '#FF3366', letterSpacing: 4,
  },
  cityDate: {
    fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: 1,
  },
  divider: { height: 1 },
  heroBlock: { gap: 2 },
  heroSub: {
    fontSize: 8, color: 'rgba(255,255,255,0.25)',
    fontWeight: '700', letterSpacing: 2,
  },
  heroLevel: { fontSize: 36, fontWeight: '900', letterSpacing: 1, lineHeight: 38 },
  heroScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  heroScore: { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  heroScoreUnit: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  hotNightsBadge: {
    marginLeft: 8, flexDirection: 'row', alignItems: 'baseline', gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  hotNightsNum: { fontSize: 15, fontWeight: '900' },
  hotNightsLabel: { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, overflow: 'hidden',
  },
  statCell: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3,
  },
  statVal: { fontSize: 17, fontWeight: '900', color: '#EEE' },
  statLabel: { fontSize: 8, color: 'rgba(255,255,255,0.25)', fontWeight: '700', letterSpacing: 0.8 },
  dnaSparkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dnaPill: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  dnaText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  sparkWrap: { alignItems: 'flex-end', gap: 2 },
  sparkLabel: { fontSize: 7, color: 'rgba(255,255,255,0.2)', fontWeight: '700', letterSpacing: 1.5 },
  topVenueRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    borderWidth: 1, borderRadius: 10, padding: 10,
  },
  topVenueLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: '700', letterSpacing: 1,
  },
  topVenueName: { fontSize: 13, fontWeight: '900', flex: 1 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  rankNum: { fontSize: 15, fontWeight: '800' },
  scoutBadge: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  scoutBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  footer: {
    borderTopWidth: 1, paddingTop: 12, alignItems: 'center',
  },
  footerText: { fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: '600', letterSpacing: 0.5 },

  // ── Modal UI ───────────────────────────────────────────────
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FF3366',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32,
    width: CARD_W,
    justifyContent: 'center',
  },
  shareBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: '500' },
});
