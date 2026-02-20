/**
 * RateVibeModal — World-Class Rating Experience
 *
 * Emoji-first option cards, venue-type-specific 4th dimension,
 * 2×2 energy grid, haptic feedback, neon glow, drag-to-dismiss.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { neonGlow, gradients, colors, easing } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;
const DISMISS_THRESHOLD = 120;

// ─── Types ─────────────────────────────────────────────────────
type EnergyLevel    = 'chill' | 'buzzing' | 'popping' | 'electric';
type CapacityLevel  = 'sparse' | 'vibrant' | 'full';
type GateLevel      = 'clear' | 'slow' | 'blocked';
type VenueType      =
  | 'club' | 'lounge' | 'restaurant' | 'bar' | 'church'
  | 'concert' | 'rave' | 'block_party' | 'festival' | 'event' | 'other';

interface EmojiOption {
  value: string;
  emoji: string;
  label: string;
}

interface RateVibeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    energy: EnergyLevel;
    capacity: CapacityLevel;
    gate: GateLevel;
    venueSpecific?: string;
    photoBase64?: string;
  }) => Promise<void>;
  venueName: string;
  venueType?: VenueType;
  isGpsVerified: boolean;
  geofenceRadius?: number;
  cooldownRemainingSeconds?: number;
  userClout?: number;
  onSkipCooldown?: (method: 'clout' | 'payment') => Promise<{ success: boolean; error?: string }>;
}

// ─── Option Configs ────────────────────────────────────────────

const ENERGY_OPTIONS: EmojiOption[] = [
  { value: 'chill',    emoji: '😌', label: 'CHILL'    },
  { value: 'buzzing',  emoji: '😏', label: 'BUZZING'  },
  { value: 'popping',  emoji: '🔥', label: 'POPPING'  },
  { value: 'electric', emoji: '🤯', label: 'ELECTRIC' },
];

const CAPACITY_OPTIONS: EmojiOption[] = [
  { value: 'sparse',  emoji: '😶', label: 'SPARSE'  },
  { value: 'vibrant', emoji: '😁', label: 'VIBRANT' },
  { value: 'full',    emoji: '😵', label: 'PACKED'  },
];

const GATE_OPTIONS: EmojiOption[] = [
  { value: 'clear',   emoji: '✅', label: 'FREE IN'  },
  { value: 'slow',    emoji: '⏳', label: 'QUEUING'  },
  { value: 'blocked', emoji: '🚫', label: 'LOCKED'   },
];

// DJ/Music — for clubs, raves, block parties, and DJ events (Obi House, Dope Caesar, etc.)
const DJ_OPTIONS: EmojiOption[] = [
  { value: 'mellow',     emoji: '😑', label: 'MELLOW'     },
  { value: 'good_set',   emoji: '😄', label: 'GOOD SET'   },
  { value: 'killing_it', emoji: '🤯', label: 'KILLING IT' },
];

// Live performance — concerts with artists/bands
const PERFORMANCE_OPTIONS: EmojiOption[] = [
  { value: 'not_started', emoji: '🎤', label: 'NOT YET'  },
  { value: 'building',    emoji: '🔥', label: 'BUILDING' },
  { value: 'lit',         emoji: '🤯', label: 'LIT'      },
];

// Restaurant service speed
const SERVICE_OPTIONS: EmojiOption[] = [
  { value: 'slow',   emoji: '🐢', label: 'SLOW'   },
  { value: 'decent', emoji: '👍', label: 'DECENT' },
  { value: 'fast',   emoji: '⚡', label: 'FAST'   },
];

// Bar / Lounge ambience
const AMBIENCE_OPTIONS: EmojiOption[] = [
  { value: 'dead',    emoji: '💀', label: 'DEAD'        },
  { value: 'chill',   emoji: '😊', label: 'CHILL'       },
  { value: 'loud',    emoji: '🔊', label: 'LOUD & FUN'  },
];

// Church worship
const WORSHIP_OPTIONS: EmojiOption[] = [
  { value: 'okay', emoji: '🙏', label: 'OKAY' },
  { value: 'good', emoji: '😊', label: 'GOOD' },
  { value: 'deep', emoji: '🔥', label: 'DEEP' },
];

// ─── Venue type → 4th dimension mapping ───────────────────────
type VenueDimConfig = { label: string; options: EmojiOption[] };

const VENUE_DIMENSION: Record<string, VenueDimConfig> = {
  club:        { label: '🎛️  DJ / MUSIC', options: DJ_OPTIONS },
  rave:        { label: '🎛️  DJ / MUSIC', options: DJ_OPTIONS },
  block_party: { label: '🎛️  DJ / MUSIC', options: DJ_OPTIONS },
  event:       { label: '🎛️  DJ / MUSIC', options: DJ_OPTIONS },  // Obi House, Dope Caesar, etc.
  festival:    { label: '🎛️  DJ / MUSIC', options: DJ_OPTIONS },
  concert:     { label: '🎤  PERFORMANCE', options: PERFORMANCE_OPTIONS },
  restaurant:  { label: '⏱️  SERVICE',    options: SERVICE_OPTIONS },
  bar:         { label: '🎵  AMBIENCE',   options: AMBIENCE_OPTIONS },
  lounge:      { label: '🎵  AMBIENCE',   options: AMBIENCE_OPTIONS },
  church:      { label: '🙏  WORSHIP',    options: WORSHIP_OPTIONS },
};

// ─── Section colors ────────────────────────────────────────────
const SECTION_COLORS = {
  energy:       ['#FF3366', '#FF6B35'] as [string, string],
  capacity:     ['#00D4FF', '#3399FF'] as [string, string],
  gate:         ['#FF9800', '#E67E22'] as [string, string],
  venueSpecific:['#9933FF', '#CC44FF'] as [string, string],
};

// ─── Component ─────────────────────────────────────────────────
const RateVibeModal: React.FC<RateVibeModalProps> = ({
  visible,
  onClose,
  onSubmit,
  venueName,
  venueType = 'other',
  isGpsVerified,
  geofenceRadius = 100,
  cooldownRemainingSeconds = 0,
  userClout = 0,
  onSkipCooldown,
}) => {
  const [energy,       setEnergy]       = useState<EnergyLevel | null>(null);
  const [capacity,     setCapacity]     = useState<CapacityLevel | null>(null);
  const [gate,         setGate]         = useState<GateLevel | null>(null);
  const [venueSpec,    setVenueSpec]    = useState<string | null>(null);
  const [photo,        setPhoto]        = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [skipping,     setSkipping]     = useState(false);
  const [skipError,    setSkipError]    = useState<string | null>(null);
  const [countdown,    setCountdown]    = useState(cooldownRemainingSeconds);
  const isOnCooldown = countdown > 0;

  const venueDim = VENUE_DIMENSION[venueType] ?? null;
  const hasFourDims = !!venueDim;
  const filledCount = [energy, capacity, gate, hasFourDims ? venueSpec : 'skip'].filter(Boolean).length;
  const canSubmit = !!(energy && capacity && gate && isGpsVerified && (!hasFourDims || venueSpec));

  // Animations
  const translateY   = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const submitScale  = useRef(new Animated.Value(1)).current;
  const submitGlow   = useRef(new Animated.Value(0)).current;
  // 16 slots: 4 energy + 3 capacity + 3 gate + 3 venue-specific + spares
  const optionScales = useRef(
    Array.from({ length: 16 }, () => new Animated.Value(1))
  ).current;

  // ─── Sheet open/close ───────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: easing.snappy.tension,
          friction: easing.snappy.friction,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  // ─── Sync cooldown ──────────────────────────────────────────
  useEffect(() => {
    setCountdown(cooldownRemainingSeconds);
    setSkipError(null);
  }, [cooldownRemainingSeconds, visible]);

  // ─── Countdown tick ─────────────────────────────────────────
  useEffect(() => {
    if (!visible || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, countdown > 0]);

  // ─── Submit button pulse ─────────────────────────────────────
  useEffect(() => {
    if (canSubmit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(submitGlow, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(submitGlow, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      submitGlow.setValue(0);
    }
  }, [canSubmit]);

  // ─── Drag to dismiss ────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dx) < Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
          dismissSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: easing.snappy.tension,
            friction: easing.snappy.friction,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const dismissSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  // ─── Option select ──────────────────────────────────────────
  const handleSelect = (index: number, setter: (v: any) => void, value: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(optionScales[index], { toValue: 1.12, duration: 90, useNativeDriver: true }),
      Animated.spring(optionScales[index], { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();
    setter(value);
  };

  // ─── Photo picker ───────────────────────────────────────────
  const handlePickPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPhoto(result.assets[0].base64);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // ─── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(submitScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(submitScale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();
    setSubmitting(true);
    try {
      await onSubmit({
        energy: energy!,
        capacity: capacity!,
        gate: gate!,
        venueSpecific: venueSpec || undefined,
        photoBase64: photo || undefined,
      });
      setEnergy(null); setCapacity(null); setGate(null);
      setVenueSpec(null); setPhoto(null);
      dismissSheet();
    } catch (err) {
      console.error('Rating failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Skip cooldown ──────────────────────────────────────────
  const handleSkip = async (method: 'clout' | 'payment') => {
    if (!onSkipCooldown || skipping) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSkipping(true); setSkipError(null);
    const result = await onSkipCooldown(method);
    setSkipping(false);
    if (result.success) setCountdown(0);
    else setSkipError(result.error || 'Skip failed');
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Render: single emoji option card ───────────────────────
  const renderEmojiCard = (
    opt: EmojiOption,
    isSelected: boolean,
    onPress: () => void,
    gradient: [string, string],
    scaleIdx: number,
    flex?: number
  ) => (
    <Animated.View
      key={opt.value}
      style={[
        styles.cardWrapper,
        flex ? { flex } : { flex: 1 },
        { transform: [{ scale: optionScales[scaleIdx] }] },
        isSelected && neonGlow(gradient[0], 'soft'),
      ]}
    >
      <TouchableOpacity
        style={[
          styles.cardInner,
          isSelected && { borderColor: gradient[0], borderWidth: 2 },
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {isSelected && (
          <LinearGradient
            colors={[gradient[0] + '22', gradient[1] + '11']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={[styles.cardEmoji, isSelected && styles.cardEmojiSelected]}>
          {opt.emoji}
        </Text>
        <Text style={[styles.cardLabel, isSelected && { color: gradient[0] }]}>
          {opt.label}
        </Text>
        {isSelected && (
          <View style={[styles.selectedDot, { backgroundColor: gradient[0] }]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  // ─── Render: 2×2 grid section (for Energy, 4 options) ───────
  const render2x2Section = (
    title: string,
    options: EmojiOption[],
    selected: string | null,
    setter: (v: any) => void,
    gradient: [string, string],
    baseIdx: number
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: gradient[0] }]}>{title}</Text>
      </View>
      <View style={styles.grid2x2}>
        <View style={styles.gridRow}>
          {options.slice(0, 2).map((opt, i) =>
            renderEmojiCard(
              opt,
              selected === opt.value,
              () => handleSelect(baseIdx + i, setter, opt.value),
              gradient,
              baseIdx + i
            )
          )}
        </View>
        <View style={styles.gridRow}>
          {options.slice(2, 4).map((opt, i) =>
            renderEmojiCard(
              opt,
              selected === opt.value,
              () => handleSelect(baseIdx + 2 + i, setter, opt.value),
              gradient,
              baseIdx + 2 + i
            )
          )}
        </View>
      </View>
    </View>
  );

  // ─── Render: single row section (3 options) ─────────────────
  const renderRowSection = (
    title: string,
    options: EmojiOption[],
    selected: string | null,
    setter: (v: any) => void,
    gradient: [string, string],
    baseIdx: number
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: gradient[0] }]}>{title}</Text>
      </View>
      <View style={styles.optionsRow}>
        {options.map((opt, i) =>
          renderEmojiCard(
            opt,
            selected === opt.value,
            () => handleSelect(baseIdx + i, setter, opt.value),
            gradient,
            baseIdx + i
          )
        )}
      </View>
    </View>
  );

  // ─── Progress dots ──────────────────────────────────────────
  const renderProgressDots = () => {
    const dims = hasFourDims
      ? [energy, capacity, gate, venueSpec]
      : [energy, capacity, gate];
    const dotColors = [
      SECTION_COLORS.energy[0],
      SECTION_COLORS.capacity[0],
      SECTION_COLORS.gate[0],
      SECTION_COLORS.venueSpecific[0],
    ];
    return (
      <View style={styles.progressRow}>
        {dims.map((val, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: val ? dotColors[i] : '#2A2A3E' },
              val && styles.progressDotFilled,
            ]}
          />
        ))}
      </View>
    );
  };

  // ─── Cooldown screen ────────────────────────────────────────
  const renderCooldownScreen = () => (
    <View style={styles.cooldownContainer}>
      <View style={styles.timerRing}>
        <Ionicons name="time" size={32} color="#FF9800" />
        <Text style={styles.timerText}>{formatCountdown(countdown)}</Text>
        <Text style={styles.timerLabel}>NEXT RATING</Text>
      </View>
      <Text style={styles.cooldownTitle}>Cooldown Active</Text>
      <Text style={styles.cooldownSubtitle}>
        The vibe is fresh — come back soon or skip the wait.
      </Text>
      {skipError && (
        <View style={styles.skipErrorPill}>
          <Ionicons name="warning" size={12} color="#FF5252" />
          <Text style={styles.skipErrorText}>{skipError}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.skipBtn, userClout < 50 && styles.skipBtnDisabled]}
        onPress={() => handleSkip('clout')}
        disabled={userClout < 50 || skipping}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={userClout >= 50 ? ['#FFD700', '#FF9800'] : ['#333', '#444']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.skipBtnGradient}
        >
          {skipping ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="star" size={16} color="#FFF" />
              <Text style={styles.skipBtnText}>Skip Wait · 50 Clout</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
      <Text style={styles.cloutBalance}>
        Your Clout: {userClout} {userClout < 50 ? '(not enough)' : '✓'}
      </Text>
      <TouchableOpacity
        style={styles.payBtn}
        onPress={() => handleSkip('payment')}
        disabled={skipping}
        activeOpacity={0.8}
      >
        <Ionicons name="card" size={15} color="#00D4FF" />
        <Text style={styles.payBtnText}>Rate Now · ₦100</Text>
      </TouchableOpacity>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={dismissSheet}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={styles.backdropTouchable} onPress={dismissSheet} activeOpacity={1} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <BlurView intensity={40} tint="dark" style={styles.blurFill}>
          <LinearGradient
            colors={['rgba(18,18,30,0.97)', 'rgba(8,8,18,0.99)']}
            style={styles.sheetGradient}
          >
            {/* Drag handle */}
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <Text style={styles.title}>Rate the Vibe</Text>
            <View style={styles.subtitleRow}>
              <Text style={styles.venueName} numberOfLines={1}>{venueName}</Text>
              <View style={[
                styles.verifiedPill,
                { backgroundColor: isGpsVerified ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)' },
              ]}>
                <Ionicons
                  name={isGpsVerified ? 'location' : 'location-outline'}
                  size={12}
                  color={isGpsVerified ? '#00E676' : '#FF5252'}
                />
                <Text style={[styles.verifiedText, { color: isGpsVerified ? '#00E676' : '#FF5252' }]}>
                  {isGpsVerified ? `${geofenceRadius}m ✓` : 'Location Required'}
                </Text>
              </View>
            </View>

            {isOnCooldown ? renderCooldownScreen() : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                bounces={false}
              >
                {renderProgressDots()}

                {/* 1. ENERGY — 2×2 grid */}
                {render2x2Section(
                  '⚡  ENERGY',
                  ENERGY_OPTIONS, energy, setEnergy,
                  SECTION_COLORS.energy, 0
                )}

                {/* 2. CAPACITY */}
                {renderRowSection(
                  '👥  CAPACITY',
                  CAPACITY_OPTIONS, capacity, setCapacity,
                  SECTION_COLORS.capacity, 4
                )}

                {/* 3. GATE / QUEUE */}
                {renderRowSection(
                  '🚪  GATE / QUEUE',
                  GATE_OPTIONS, gate, setGate,
                  SECTION_COLORS.gate, 7
                )}

                {/* 4. VENUE-SPECIFIC (optional) */}
                {hasFourDims && venueDim && renderRowSection(
                  venueDim.label,
                  venueDim.options, venueSpec, setVenueSpec,
                  SECTION_COLORS.venueSpecific, 10
                )}

                {/* Action row */}
                <View style={styles.actionRow}>
                  {/* Photo */}
                  <TouchableOpacity
                    style={[styles.photoBtn, photo && styles.photoBtnActive]}
                    onPress={handlePickPhoto}
                    activeOpacity={0.7}
                  >
                    {photo ? (
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${photo}` }}
                        style={styles.photoThumb}
                      />
                    ) : (
                      <Ionicons name="camera" size={18} color="#FFF" />
                    )}
                    <Text style={styles.photoBtnText}>
                      {photo ? 'Photo Added' : 'Add Photo'}
                    </Text>
                    {!photo && <Text style={styles.cloutBonus}>+5</Text>}
                  </TouchableOpacity>

                  {/* Submit */}
                  <Animated.View
                    style={[
                      styles.submitWrapper,
                      { transform: [{ scale: submitScale }] },
                      canSubmit && neonGlow(colors.primary, 'medium'),
                    ]}
                  >
                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={!canSubmit || submitting}
                      activeOpacity={0.8}
                      style={styles.submitTouchable}
                    >
                      {canSubmit ? (
                        <LinearGradient
                          colors={gradients.neonPink as unknown as [string, string]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={styles.submitGradient}
                        >
                          {submitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <>
                              <Text style={styles.submitEmoji}>✦</Text>
                              <Text style={styles.submitText}>Drop the Vibe</Text>
                            </>
                          )}
                        </LinearGradient>
                      ) : (
                        <View style={styles.submitDisabled}>
                          <Text style={styles.submitTextDisabled}>
                            {filledCount}/{hasFourDims ? 4 : 3} done
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </ScrollView>
            )}
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  backdropTouchable: { flex: 1 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  blurFill: { flex: 1 },
  sheetGradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  handleRow: { alignItems: 'center', paddingBottom: 14 },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: {
    fontSize: 26, fontWeight: '800', color: '#FFF',
    textAlign: 'center', letterSpacing: -0.5,
  },
  subtitleRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 10, marginTop: 8, marginBottom: 2,
  },
  venueName: {
    fontSize: 13, color: '#999', fontWeight: '600', maxWidth: 170,
  },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  verifiedText: { fontSize: 11, fontWeight: '700' },

  scrollContent: { paddingBottom: 40 },

  progressRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginVertical: 16,
  },
  progressDot: {
    width: 7, height: 7, borderRadius: 4,
  },
  progressDotFilled: {
    width: 20, height: 7, borderRadius: 4,
  },

  section: { marginBottom: 20 },
  sectionHeader: { marginBottom: 10 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2,
  },

  // 2×2 grid for energy
  grid2x2: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },

  // Single row for capacity / gate / venue-specific
  optionsRow: { flexDirection: 'row', gap: 10 },

  // Emoji card
  cardWrapper: {
    borderRadius: 16, overflow: 'hidden',
  },
  cardInner: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  cardEmoji: {
    fontSize: 32,
    lineHeight: 38,
  },
  cardEmojiSelected: {
    fontSize: 36,
    lineHeight: 42,
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  selectedDot: {
    width: 5, height: 5, borderRadius: 3,
    marginTop: 2,
  },

  // Action row
  actionRow: {
    flexDirection: 'row', gap: 12, marginTop: 8,
  },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 15, borderRadius: 16, gap: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  photoBtnActive: {
    borderColor: 'rgba(0,230,118,0.4)',
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  photoThumb: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#00E676',
  },
  photoBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  cloutBonus: {
    fontSize: 10, color: '#FFD700', fontWeight: '800',
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },

  submitWrapper: {
    flex: 1.6, borderRadius: 16, overflow: 'hidden',
  },
  submitTouchable: { borderRadius: 16, overflow: 'hidden' },
  submitGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 8, borderRadius: 16,
  },
  submitEmoji: { fontSize: 16, color: '#FFF' },
  submitText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  submitDisabled: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  submitTextDisabled: { fontSize: 13, fontWeight: '700', color: '#555' },

  // Cooldown
  cooldownContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 12,
  },
  timerRing: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: '#FF9800',
    alignItems: 'center', justifyContent: 'center',
    gap: 2, backgroundColor: 'rgba(255,152,0,0.08)',
    marginBottom: 8,
  },
  timerText: {
    fontSize: 28, fontWeight: '900', color: '#FF9800', letterSpacing: -1,
  },
  timerLabel: {
    fontSize: 9, fontWeight: '800', color: '#FF9800',
    letterSpacing: 2, opacity: 0.7,
  },
  cooldownTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  cooldownSubtitle: {
    fontSize: 13, color: '#888', textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 8,
  },
  skipErrorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,82,82,0.12)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  skipErrorText: { fontSize: 12, color: '#FF5252', fontWeight: '600' },
  skipBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  skipBtnDisabled: { opacity: 0.5 },
  skipBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8, borderRadius: 14,
  },
  skipBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  cloutBalance: { fontSize: 11, color: '#888', fontWeight: '600' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, width: '100%',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    backgroundColor: 'rgba(0,212,255,0.05)',
  },
  payBtnText: { fontSize: 13, fontWeight: '700', color: '#00D4FF' },
});

export default RateVibeModal;
