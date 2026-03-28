/**
 * MomentMemoryCard — Memory Artifact
 *
 * Post-night shareable visual built from the Moment mechanic's data.
 * Fetches tonight's moment timeline from the backend, renders:
 *
 *   — Energy arc: Skia sparkline of moment trigger density over the night
 *   — Moment Lock markers: vertical lines at every collective lock
 *   — Scout contribution chip: how many triggers the current scout fired
 *   — Peak participant count at the biggest lock
 *   — Venue name, city, date
 *
 * Captured as PNG via react-native-view-shot.
 * Share options:
 *   — Native share sheet (primary, works everywhere)
 *   — IG Stories quick-pick (iOS: opens instagram-stories:// URI)
 *   — Snapchat quick-pick (opens snapchat:// then user picks from camera roll)
 *
 * Triggered from venue screen AfterHours section or Moment Lock toast tap.
 */
import React, {
  useRef, useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, ActivityIndicator, Platform, Linking, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path, Skia, Paint, Circle } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = Math.min(340, SCREEN_W - 32);
const ARC_W  = CARD_W - 40;  // canvas width inside card padding
const ARC_H  = 80;

const ACCENT  = '#6655FF';
const LOCK_C  = '#FF3366';
const GOLD    = '#C9A84C';

// ─── API Types ────────────────────────────────────────────────────────────────

interface MomentDoc {
  _id:           string;
  server_ts:     string;   // ISO
  g_force:       number;
  gesture:       string;
  moment_locked: boolean;
}

interface LockDoc {
  _id:              string;
  locked_at:        string;  // ISO
  participant_count: number;
  venue_name:       string;
}

interface TonightData {
  venue_id:     string;
  moment_count: number;
  lock_count:   number;
  moments:      MomentDoc[];
  locks:        LockDoc[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MomentMemoryProps {
  venueId:      string;
  venueName:    string;
  city:         string;
  sessionToken: string;
  visible:      boolean;
  onClose:      () => void;
  /** Current user's ID — used to count personal triggers */
  userId?:      string;
  /** Override accent color (e.g. from venue's vibe level) */
  vibeColor?:   string;
  /** Tonight's peak vibe score — displayed if provided */
  peakScore?:   number;
}

// ─── Energy arc canvas ────────────────────────────────────────────────────────

interface ArcProps {
  moments:   MomentDoc[];
  locks:     LockDoc[];
  color:     string;
  width:     number;
  height:    number;
}

function EnergyArc({ moments, locks, color, width, height }: ArcProps) {
  const { fillPath, linePath, lockXs, peakCircles } = useMemo(() => {
    if (!moments.length) {
      // Flat line
      const p = Skia.Path.Make();
      p.moveTo(0, height * 0.7);
      p.lineTo(width, height * 0.7);
      return { fillPath: p, linePath: p, lockXs: [], peakCircles: [] };
    }

    const timestamps = moments.map(m => new Date(m.server_ts).getTime());
    const tMin = Math.min(...timestamps);
    const tMax = Math.max(...timestamps) || tMin + 1;

    // Bucket into N bins and count intensity (weighted by g_force)
    const BINS = Math.min(40, moments.length);
    const binWidth = (tMax - tMin) / BINS || 1;
    const bins = Array(BINS).fill(0) as number[];
    moments.forEach(m => {
      const idx = Math.min(
        BINS - 1,
        Math.floor((new Date(m.server_ts).getTime() - tMin) / binWidth),
      );
      bins[idx] += 1 + (m.g_force / 10);  // weighted by physical intensity
    });
    const maxBin = Math.max(...bins, 0.1);

    const PAD_Y = 10;
    const norm = (v: number) => height - PAD_Y - ((v / maxBin) * (height - PAD_Y * 2));
    const xOf  = (i: number) => (i / (BINS - 1)) * width;

    // Smooth via Catmull-Rom style: use lineTo — smooth enough at 40 bins
    const fill = Skia.Path.Make();
    const line = Skia.Path.Make();
    fill.moveTo(0, height);
    fill.lineTo(0, norm(bins[0]));
    line.moveTo(0, norm(bins[0]));
    bins.forEach((v, i) => {
      if (i === 0) return;
      fill.lineTo(xOf(i), norm(v));
      line.lineTo(xOf(i), norm(v));
    });
    fill.lineTo(width, height);
    fill.close();

    // Lock vertical positions (x coordinate)
    const lockTs = locks.map(l => new Date(l.locked_at).getTime());
    const lxs = lockTs.map(t => {
      const fraction = (t - tMin) / (tMax - tMin);
      return Math.max(0, Math.min(width, fraction * width));
    });

    // Peak circles: top of the highest bin per lock
    const peaks = lxs.map(lx => {
      const i = Math.round((lx / width) * (BINS - 1));
      return { x: lx, y: norm(bins[Math.max(0, i)]) };
    });

    return { fillPath: fill, linePath: line, lockXs: lxs, peakCircles: peaks };
  }, [moments, locks, width, height]);

  return (
    <Canvas style={{ width, height }}>
      {/* Area fill */}
      <Path path={fillPath} color={color + '1A'} style="fill" />
      {/* Line */}
      <Path path={linePath} style="stroke">
        <Paint style="stroke" strokeWidth={2} color={color} strokeCap="round" strokeJoin="round" />
      </Path>
      {/* Lock vertical lines */}
      {lockXs.map((lx, i) => {
        const lockLine = Skia.Path.Make();
        lockLine.moveTo(lx, 0);
        lockLine.lineTo(lx, height);
        return (
          <Path key={i} path={lockLine} style="stroke">
            <Paint style="stroke" strokeWidth={1.5} color={LOCK_C + 'BB'} />
          </Path>
        );
      })}
      {/* Glow dots at peak of each lock */}
      {peakCircles.map((pt, i) => (
        <React.Fragment key={i}>
          <Circle cx={pt.x} cy={pt.y} r={7} color={LOCK_C + '33'} />
          <Circle cx={pt.x} cy={pt.y} r={3.5} color={LOCK_C} />
        </React.Fragment>
      ))}
    </Canvas>
  );
}

// ─── Card (capturable) ────────────────────────────────────────────────────────

interface CardData {
  venueName:        string;
  city:             string;
  date:             string;
  momentCount:      number;
  lockCount:        number;
  peakParticipants: number;
  peakScore?:       number;
  moments:          MomentDoc[];
  locks:            LockDoc[];
  accentColor:      string;
}

const MemoryCardView = React.forwardRef<View, { data: CardData }>(
  ({ data }, ref) => {
    const {
      venueName, city, date, momentCount, lockCount,
      peakParticipants, peakScore, moments, locks, accentColor,
    } = data;

    const durationLabel = useMemo(() => {
      if (!moments.length) return null;
      const first = new Date(moments[0].server_ts);
      const last  = new Date(moments[moments.length - 1].server_ts);
      const mins  = Math.round((last.getTime() - first.getTime()) / 60000);
      if (mins < 2)  return null;
      if (mins < 60) return `${mins}m window`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }, [moments]);

    return (
      <View ref={ref} style={[styles.card, { width: CARD_W }]} collapsable={false}>
        <LinearGradient
          colors={['#06060F', '#0A0A1C', '#06060F']}
          style={StyleSheet.absoluteFill}
        />

        {/* Ambient glow */}
        <View style={[styles.glowWash, { shadowColor: accentColor }]} />

        {/* ── Top row ── */}
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Text style={styles.brandMark}>VIIBE</Text>
            <View style={[styles.memoryPill, { borderColor: accentColor + '55', backgroundColor: accentColor + '18' }]}>
              <Text style={[styles.memoryPillText, { color: accentColor }]}>MEMORY</Text>
            </View>
          </View>
          <Text style={styles.cityDate}>{city.toUpperCase()} · {date}</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: accentColor + '22' }]} />

        {/* ── Venue hero ── */}
        <View style={styles.heroBlock}>
          <Text style={styles.heroSub}>YOU WERE AT</Text>
          <Text style={[styles.venueName, { color: '#FFFFFF' }]} numberOfLines={2}>
            {venueName}
          </Text>
          {peakScore !== undefined && (
            <View style={styles.peakScoreRow}>
              <Ionicons name="flash" size={11} color={accentColor} />
              <Text style={[styles.peakScoreText, { color: accentColor }]}>
                PEAK VIBE {peakScore}
              </Text>
            </View>
          )}
        </View>

        {/* ── Energy arc ── */}
        <View style={styles.arcWrap}>
          <Text style={styles.arcLabel}>ENERGY ARC</Text>
          {moments.length > 0 ? (
            <EnergyArc
              moments={moments}
              locks={locks}
              color={accentColor}
              width={ARC_W}
              height={ARC_H}
            />
          ) : (
            <View style={[styles.arcEmpty, { width: ARC_W, height: ARC_H }]}>
              <Text style={styles.arcEmptyText}>No signals recorded</Text>
            </View>
          )}
          {durationLabel && (
            <Text style={styles.durationLabel}>{durationLabel}</Text>
          )}
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCell
            icon="radio-button-on"
            value={momentCount}
            label="SIGNALS"
            color={accentColor}
          />
          <View style={styles.statDivider} />
          <StatCell
            icon="flash"
            value={lockCount}
            label="LOCKS"
            color={LOCK_C}
          />
          <View style={styles.statDivider} />
          <StatCell
            icon="people"
            value={peakParticipants}
            label="PEAK SCOUTS"
            color={GOLD}
          />
        </View>

        {/* ── Lock timeline chips ── */}
        {locks.length > 0 && (
          <View style={styles.locksSection}>
            <Text style={styles.locksSectionLabel}>MOMENT LOCKS</Text>
            <View style={styles.lockChips}>
              {locks.slice(0, 4).map((l, i) => {
                const t = new Date(l.locked_at);
                const hh = t.getHours().toString().padStart(2, '0');
                const mm = t.getMinutes().toString().padStart(2, '0');
                return (
                  <View key={i} style={styles.lockChip}>
                    <View style={styles.lockDot} />
                    <Text style={styles.lockTime}>{hh}:{mm}</Text>
                    <Text style={styles.lockPax}>{l.participant_count} scouts</Text>
                  </View>
                );
              })}
              {locks.length > 4 && (
                <View style={styles.lockChip}>
                  <Text style={styles.lockMore}>+{locks.length - 4} more</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={[styles.footer, { borderTopColor: accentColor + '18' }]}>
          <Text style={styles.footerText}>viibe.app · feel the scene</Text>
        </View>
      </View>
    );
  },
);

function StatCell({
  icon, value, label, color,
}: {
  icon: string; value: number; label: string; color: string;
}) {
  return (
    <View style={styles.statCell}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Empty state card ─────────────────────────────────────────────────────────

function EmptyState({ color }: { color: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="radio-button-off-outline" size={36} color={color + '55'} />
      <Text style={styles.emptyTitle}>No Moments Yet</Text>
      <Text style={styles.emptyBody}>
        Shake your phone, raise to face, or back tap to fire your first signal.
      </Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MomentMemoryCard({
  venueId,
  venueName,
  city,
  sessionToken,
  visible,
  onClose,
  vibeColor = ACCENT,
  peakScore,
}: MomentMemoryProps) {
  const cardRef = useRef<View>(null);

  const [data,    setData]    = useState<TonightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Sheet animation
  const sheetY    = useSharedValue(SCREEN_H);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      bgOpacity.value = withTiming(1, { duration: 260 });
      sheetY.value    = withSpring(0, { stiffness: 150, damping: 22 });
      fetchData();
    } else {
      bgOpacity.value = withTiming(0, { duration: 220 });
      sheetY.value    = withTiming(SCREEN_H, { duration: 300, easing: Easing.in(Easing.ease) });
    }
  }, [visible]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/moments/tonight`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };

  const cardData: CardData | null = data
    ? {
        venueName,
        city,
        date:             formatDate(new Date()),
        momentCount:      data.moment_count,
        lockCount:        data.lock_count,
        peakParticipants: data.locks.length
          ? Math.max(...data.locks.map(l => l.participant_count))
          : 0,
        peakScore,
        moments:     data.moments,
        locks:       data.locks,
        accentColor: vibeColor,
      }
    : null;

  // ── Capture + share (native) ───────────────────────────────────────────────
  const captureAndShare = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Share', 'Screenshot sharing is not available on web.');
      return;
    }
    if (!cardRef.current || !cardData) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { captureRef } = require('react-native-view-shot');
      const Sharing        = require('expo-sharing');
      const uri = await captureRef(cardRef, { format: 'png', quality: 0.96 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType:    'image/png',
          dialogTitle: 'Share your Moment Memory',
          UTI:         'public.png',
        });
      }
    } catch {}
    setSharing(false);
  }, [cardData]);

  // ── IG Stories quick-share (iOS) ───────────────────────────────────────────
  const shareToInstagram = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      // Android: open native share, user picks IG
      captureAndShare();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { captureRef }   = require('react-native-view-shot');
      const { setImageAsync } = require('expo-clipboard');
      const uri = await captureRef(cardRef, { format: 'png', quality: 0.96 });
      // Write to clipboard then open IG Stories
      await setImageAsync(uri, { imageFormat: 'png' });
      const igUrl = 'instagram-stories://share?source_application=viibe';
      const canOpen = await Linking.canOpenURL(igUrl);
      if (canOpen) {
        await Linking.openURL(igUrl);
      } else {
        // IG not installed — fall back to native share
        captureAndShare();
      }
    } catch {
      captureAndShare();
    }
  }, [captureAndShare]);

  // ── Snapchat quick-share ───────────────────────────────────────────────────
  const shareToSnapchat = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { captureRef }   = require('react-native-view-shot');
      const Sharing          = require('expo-sharing');
      const uri = await captureRef(cardRef, { format: 'png', quality: 0.96 });
      // Save then open Snapchat (user selects from camera roll in Snap)
      const canOpen = await Linking.canOpenURL('snapchat://');
      if (canOpen) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        // Snapchat not installed
        captureAndShare();
      }
    } catch {
      captureAndShare();
    }
  }, [captureAndShare]);

  const overlayStyle  = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>

      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, overlayStyle]} />

      {/* Sheet */}
      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <BlurView intensity={65} tint="dark" style={styles.sheet}>

          {/* Handle */}
          <View style={styles.handle} />

          {/* Header row */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.sheetTitle}>MOMENT MEMORY</Text>
              <Text style={styles.sheetSub}>Your energy arc from tonight</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          {/* Card preview */}
          <View style={styles.cardWrap}>
            {loading ? (
              <View style={[styles.loadingBox, { width: CARD_W }]}>
                <ActivityIndicator color={vibeColor} />
                <Text style={styles.loadingText}>Loading tonight's data…</Text>
              </View>
            ) : cardData && (cardData.momentCount > 0 || cardData.lockCount > 0) ? (
              <MemoryCardView ref={cardRef} data={cardData} />
            ) : (
              <EmptyState color={vibeColor} />
            )}
          </View>

          {/* Share actions */}
          {!loading && cardData && cardData.momentCount > 0 && (
            <>
              {/* Primary CTA */}
              <TouchableOpacity
                style={[styles.primaryShare, { opacity: sharing ? 0.5 : 1 }]}
                onPress={captureAndShare}
                activeOpacity={0.8}
                disabled={sharing}
              >
                <LinearGradient
                  colors={[vibeColor, '#8844FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.primaryShareGradient}
                >
                  {sharing
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <>
                        <Ionicons name="share-outline" size={16} color="#FFF" />
                        <Text style={styles.primaryShareText}>SHARE YOUR MEMORY</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Quick picks */}
              <View style={styles.quickPicks}>
                <Text style={styles.quickPicksLabel}>SHARE DIRECT</Text>
                <View style={styles.quickPickRow}>
                  {/* Instagram */}
                  <TouchableOpacity style={styles.quickPickBtn} onPress={shareToInstagram} activeOpacity={0.75}>
                    <LinearGradient
                      colors={['#833AB4', '#FD1D1D', '#F77737']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.quickPickGradient}
                    >
                      <Ionicons name="logo-instagram" size={20} color="#FFF" />
                    </LinearGradient>
                    <Text style={styles.quickPickLabel}>Stories</Text>
                  </TouchableOpacity>

                  {/* Snapchat */}
                  <TouchableOpacity style={styles.quickPickBtn} onPress={shareToSnapchat} activeOpacity={0.75}>
                    <View style={[styles.quickPickGradient, { backgroundColor: '#FFFC00' }]}>
                      <Ionicons name="logo-snapchat" size={20} color="#000" />
                    </View>
                    <Text style={styles.quickPickLabel}>Snapchat</Text>
                  </TouchableOpacity>

                  {/* More */}
                  <TouchableOpacity style={styles.quickPickBtn} onPress={captureAndShare} activeOpacity={0.75}>
                    <View style={[styles.quickPickGradient, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                      <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.quickPickLabel}>More</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <View style={{ height: 8 }} />
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderBottomWidth: 0,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 13, fontWeight: '900', color: '#FFF',
    letterSpacing: 2,
  },
  sheetSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)',
    fontWeight: '500', marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Card ───────────────────────────────────────────────────
  cardWrap: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    padding: 20,
    gap: 14,
  },
  glowWash: {
    position: 'absolute',
    top: -20, alignSelf: 'center',
    width: 180, height: 180,
    borderRadius: 90,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 50,
    elevation: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  brandMark: {
    fontSize: 20, fontWeight: '900', color: '#FF3366', letterSpacing: 4,
  },
  memoryPill: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  memoryPillText: {
    fontSize: 8, fontWeight: '900', letterSpacing: 1.5,
  },
  cityDate: {
    fontSize: 9, color: 'rgba(255,255,255,0.3)',
    fontWeight: '700', letterSpacing: 0.8,
  },
  divider: { height: 1 },
  heroBlock: { gap: 4 },
  heroSub: {
    fontSize: 8, color: 'rgba(255,255,255,0.25)',
    fontWeight: '700', letterSpacing: 2,
  },
  venueName: {
    fontSize: 22, fontWeight: '900', lineHeight: 26, letterSpacing: 0.3,
  },
  peakScoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2,
  },
  peakScoreText: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },

  // ── Energy arc ─────────────────────────────────────────────
  arcWrap: { gap: 6 },
  arcLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.25)',
    fontWeight: '700', letterSpacing: 2,
  },
  arcEmpty: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
  },
  arcEmptyText: {
    fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: '500',
  },
  durationLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.2)',
    fontWeight: '600', alignSelf: 'flex-end', letterSpacing: 0.5,
  },

  // ── Stats ──────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, overflow: 'hidden',
  },
  statCell: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3,
  },
  statDivider: {
    width: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 10,
  },
  statVal: {
    fontSize: 20, fontWeight: '900',
  },
  statLabel: {
    fontSize: 7, color: 'rgba(255,255,255,0.25)',
    fontWeight: '700', letterSpacing: 0.8,
  },

  // ── Lock chips ─────────────────────────────────────────────
  locksSection: { gap: 8 },
  locksSectionLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.25)',
    fontWeight: '700', letterSpacing: 2,
  },
  lockChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  lockChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.2)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  lockDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: LOCK_C,
  },
  lockTime: {
    fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.5,
  },
  lockPax: {
    fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '600',
  },
  lockMore: {
    fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '700',
  },

  // ── Footer ─────────────────────────────────────────────────
  footer: {
    borderTopWidth: 1, paddingTop: 12, alignItems: 'center',
  },
  footerText: {
    fontSize: 9, color: 'rgba(255,255,255,0.18)',
    fontWeight: '600', letterSpacing: 0.5,
  },

  // ── Loading / empty ────────────────────────────────────────
  loadingBox: {
    height: 200, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500',
  },
  emptyState: {
    width: CARD_W, alignItems: 'center', paddingVertical: 40, gap: 12, paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15, fontWeight: '900', color: '#FFF',
  },
  emptyBody: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', lineHeight: 18, fontWeight: '500',
  },

  // ── Share CTAs ─────────────────────────────────────────────
  primaryShare: {
    marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 16,
  },
  primaryShareGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 8,
  },
  primaryShareText: {
    fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 1.5,
  },
  quickPicks: {
    paddingHorizontal: 20, gap: 10,
  },
  quickPicksLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.2)',
    fontWeight: '700', letterSpacing: 2,
  },
  quickPickRow: {
    flexDirection: 'row', gap: 12,
  },
  quickPickBtn: {
    alignItems: 'center', gap: 6,
  },
  quickPickGradient: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  quickPickLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
  },
});
