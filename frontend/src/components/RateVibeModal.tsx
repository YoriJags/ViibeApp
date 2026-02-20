/**
 * RateVibeModal - Premium Bottom Sheet Rating Experience
 *
 * Glassmorphism bottom sheet with haptic feedback, neon glow animations,
 * icon-per-option selection, progress dots, and animated submit button.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { neonGlow, gradients, colors, easing } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.78;
const DISMISS_THRESHOLD = 120;

type EnergyLevel = 'chill' | 'good_vibes' | 'popping' | 'electric';
type CapacityLevel = 'sparse' | 'vibrant' | 'full';
type GateLevel = 'clear' | 'slow' | 'blocked';

interface RateVibeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    energy: EnergyLevel;
    capacity: CapacityLevel;
    gate: GateLevel;
    photoBase64?: string;
  }) => Promise<void>;
  venueName: string;
  isGpsVerified: boolean;
  geofenceRadius?: number;
  // Cooldown props
  cooldownRemainingSeconds?: number;
  userClout?: number;
  onSkipCooldown?: (method: 'clout' | 'payment') => Promise<{ success: boolean; error?: string }>;
}

// ─── Option Configs ───────────────────────────────────────────
const ENERGY_OPTIONS: { value: EnergyLevel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'chill', label: 'CHILL', icon: 'moon' },
  { value: 'good_vibes', label: 'GOOD VIBES', icon: 'happy' },
  { value: 'popping', label: 'POPPING', icon: 'musical-notes' },
  { value: 'electric', label: 'ELECTRIC', icon: 'flash' },
];

const CAPACITY_OPTIONS: { value: CapacityLevel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'sparse', label: 'SPARSE', icon: 'people-outline' },
  { value: 'vibrant', label: 'VIBRANT', icon: 'people' },
  { value: 'full', label: 'FULL', icon: 'people-circle' },
];

const GATE_OPTIONS: { value: GateLevel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'clear', label: 'CLEAR', icon: 'checkmark-circle' },
  { value: 'slow', label: 'SLOW', icon: 'time' },
  { value: 'blocked', label: 'BLOCKED', icon: 'close-circle' },
];

const SECTION_COLORS = {
  energy: ['#FF3366', '#FF6B35'] as [string, string],
  capacity: ['#00D4FF', '#3399FF'] as [string, string],
  gate: ['#FF9800', '#E67E22'] as [string, string],
};

const RateVibeModal: React.FC<RateVibeModalProps> = ({
  visible,
  onClose,
  onSubmit,
  venueName,
  isGpsVerified,
  geofenceRadius = 100,
  cooldownRemainingSeconds = 0,
  userClout = 0,
  onSkipCooldown,
}) => {
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [capacity, setCapacity] = useState<CapacityLevel | null>(null);
  const [gate, setGate] = useState<GateLevel | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(cooldownRemainingSeconds);
  const isOnCooldown = countdown > 0;

  // Animations
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const submitScale = useRef(new Animated.Value(1)).current;
  const submitGlow = useRef(new Animated.Value(0)).current;
  const optionScales = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(1))
  ).current;

  const filledCount = [energy, capacity, gate].filter(Boolean).length;
  const canSubmit = energy && capacity && gate && isGpsVerified;

  // ─── Sheet Animation ─────────────────────────────────────────
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
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  // ─── Sync cooldown from props ─────────────────────────────────
  useEffect(() => {
    setCountdown(cooldownRemainingSeconds);
    setSkipError(null);
  }, [cooldownRemainingSeconds, visible]);

  // ─── Countdown tick ────────────────────────────────────────────
  useEffect(() => {
    if (!visible || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, countdown > 0]);

  // ─── Submit Button Pulse when all filled ──────────────────────
  useEffect(() => {
    if (canSubmit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(submitGlow, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(submitGlow, {
            toValue: 0.3,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      submitGlow.setValue(0);
    }
  }, [canSubmit]);

  // ─── Drag to Dismiss ─────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 8 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.5) {
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
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  // ─── Handlers ─────────────────────────────────────────────────
  const handleSelectOption = (
    index: number,
    setter: (val: any) => void,
    value: any
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Spring bounce on the selected option
    Animated.sequence([
      Animated.timing(optionScales[index], {
        toValue: 1.08,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(optionScales[index], {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    setter(value);
  };

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

  const handleSubmit = async () => {
    if (!canSubmit) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Bounce the submit button
    Animated.sequence([
      Animated.timing(submitScale, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(submitScale, {
        toValue: 1,
        tension: 200,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    setSubmitting(true);
    try {
      await onSubmit({
        energy: energy!,
        capacity: capacity!,
        gate: gate!,
        photoBase64: photo || undefined,
      });
      // Reset form
      setEnergy(null);
      setCapacity(null);
      setGate(null);
      setPhoto(null);
      dismissSheet();
    } catch (error) {
      console.error('Failed to submit rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async (method: 'clout' | 'payment') => {
    if (!onSkipCooldown || skipping) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSkipping(true);
    setSkipError(null);
    const result = await onSkipCooldown(method);
    setSkipping(false);
    if (result.success) {
      setCountdown(0);
    } else {
      setSkipError(result.error || 'Skip failed');
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderCooldownScreen = () => (
    <View style={styles.cooldownContainer}>
      {/* Timer ring */}
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

      {/* Skip with Clout */}
      <TouchableOpacity
        style={[
          styles.skipBtn,
          userClout < 50 && styles.skipBtnDisabled,
        ]}
        onPress={() => handleSkip('clout')}
        disabled={userClout < 50 || skipping}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={userClout >= 50 ? ['#FFD700', '#FF9800'] : ['#333', '#444']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
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

      {/* Pay to skip */}
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

  // ─── Render Helpers ───────────────────────────────────────────
  const renderProgressDots = () => (
    <View style={styles.progressRow}>
      {[energy, capacity, gate].map((val, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            val
              ? { backgroundColor: [colors.primary, '#00D4FF', '#FF9800'][i] }
              : { backgroundColor: '#2A2A3E' },
          ]}
        />
      ))}
    </View>
  );

  const renderOptionButton = (
    option: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap },
    isSelected: boolean,
    onPress: () => void,
    sectionGradient: [string, string],
    scaleIndex: number
  ) => (
    <Animated.View
      key={option.value}
      style={[
        styles.optionWrapper,
        { transform: [{ scale: optionScales[scaleIndex] }] },
        isSelected && neonGlow(sectionGradient[0], 'soft'),
      ]}
    >
      <TouchableOpacity
        style={styles.optionTouchable}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {isSelected ? (
          <LinearGradient
            colors={sectionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.optionGradient}
          >
            <Ionicons name={option.icon} size={22} color="#FFF" />
            <Text style={styles.optionTextSelected}>{option.label}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.optionInner}>
            <Ionicons name={option.icon} size={20} color="#888" />
            <Text style={styles.optionText}>{option.label}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSection = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    options: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }[],
    selected: string | null,
    setter: (val: any) => void,
    sectionGradient: [string, string],
    baseIndex: number
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={14} color={sectionGradient[0]} />
        <Text style={[styles.sectionLabel, { color: sectionGradient[0] }]}>{title}</Text>
      </View>
      <View style={styles.optionsRow}>
        {options.map((opt, i) =>
          renderOptionButton(
            opt,
            selected === opt.value,
            () => handleSelectOption(baseIndex + i, setter, opt.value),
            sectionGradient,
            baseIndex + i
          )
        )}
      </View>
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
        style={[
          styles.sheet,
          { transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <BlurView intensity={40} tint="dark" style={styles.blurFill}>
          <LinearGradient
            colors={['rgba(20,20,35,0.95)', 'rgba(10,10,20,0.98)']}
            style={styles.sheetGradient}
          >
            {/* Drag Handle */}
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
                <Text style={[
                  styles.verifiedText,
                  { color: isGpsVerified ? '#00E676' : '#FF5252' },
                ]}>
                  {isGpsVerified ? `${geofenceRadius}m Verified` : 'Location Required'}
                </Text>
              </View>
            </View>

            {/* Cooldown Screen or Rating Form */}
            {isOnCooldown ? renderCooldownScreen() : (
              <>
                {/* Progress Dots */}
                {renderProgressDots()}

                {/* Sections */}
                {renderSection('ENERGY', 'flash', ENERGY_OPTIONS, energy, setEnergy, SECTION_COLORS.energy, 0)}
                {renderSection('CAPACITY', 'people', CAPACITY_OPTIONS, capacity, setCapacity, SECTION_COLORS.capacity, 4)}
                {renderSection('GATE / QUEUE', 'ellipse-outline', GATE_OPTIONS, gate, setGate, SECTION_COLORS.gate, 7)}
              </>
            )}

            {/* Action Row (hidden during cooldown) */}
            {!isOnCooldown && (<View style={styles.actionRow}>
              {/* Photo Button */}
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
                {!photo && <Text style={styles.cloutText}>+5 Clout</Text>}
              </TouchableOpacity>

              {/* Submit Button */}
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
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                          <Text style={styles.submitText}>Update Vibe</Text>
                        </>
                      )}
                    </LinearGradient>
                  ) : (
                    <View style={styles.submitDisabled}>
                      <Ionicons name="checkmark-circle" size={20} color="#555" />
                      <Text style={styles.submitTextDisabled}>
                        {filledCount}/3 Selected
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>)}
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  blurFill: {
    flex: 1,
  },
  sheetGradient: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  venueName: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
    maxWidth: 160,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 14,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionTouchable: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionInner: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  optionGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
  },
  optionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 1,
  },
  optionTextSelected: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  photoBtnActive: {
    borderColor: 'rgba(0,230,118,0.4)',
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  photoThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#00E676',
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  cloutText: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: '700',
  },
  submitWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitTouchable: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderRadius: 14,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  submitDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  submitTextDisabled: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  // Cooldown styles
  cooldownContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  timerRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,152,0,0.08)',
    marginBottom: 8,
  },
  timerText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF9800',
    letterSpacing: -1,
  },
  timerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF9800',
    letterSpacing: 2,
    opacity: 0.7,
  },
  cooldownTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  cooldownSubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  skipErrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,82,82,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  skipErrorText: {
    fontSize: 12,
    color: '#FF5252',
    fontWeight: '600',
  },
  skipBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  skipBtnDisabled: {
    opacity: 0.5,
  },
  skipBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderRadius: 14,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  cloutBalance: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    backgroundColor: 'rgba(0,212,255,0.05)',
  },
  payBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00D4FF',
  },
});

export default RateVibeModal;
