/**
 * OnboardingFlow — Fastest path to the reactor.
 *
 * 2 info slides → mode pick → call name → done.
 * Target: new user hits "Locked In" within 90 seconds of completing onboarding.
 *
 * Removed: persona picker (moved to profile settings — not needed at door).
 * Cut: 4 info slides → 2 (one concept per slide, no padding).
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const { colors } = publicTheme;

interface OnboardingFlowProps {
  onComplete: () => void;
}

interface OnboardingPage {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  headline: string;
  body: string;
  accent: string;
}

const pages: OnboardingPage[] = [
  {
    id: '1',
    icon: 'map',
    iconColor: '#FF3366',
    headline: "Know exactly where\nto be tonight.",
    body: "Clubs. Restaurants. Concerts. Lounges. Anywhere people gather, there's a live energy score.\n\nVIIBE shows you what's actually happening — right now, not last week.",
    accent: '#FF3366',
  },
  {
    id: '2',
    icon: 'flash',
    iconColor: '#9933FF',
    headline: 'Tap. Feel the vibe.\nOwn the night.',
    body: "Step inside a venue and tap to power its live energy. The reactor ring responds to your rhythm — solo or with a crowd.\n\nBuild your scout rank, earn clout, and rise through the city.",
    accent: '#9933FF',
  },
];

type UserMode = 'scout' | 'insider';

const MODES: {
  key: UserMode;
  emoji: string;
  label: string;
  subtitle: string;
  description: string;
  gradient: [string, string];
  accentColor: string;
}[] = [
  {
    key: 'scout',
    emoji: '📡',
    label: 'Scout',
    subtitle: 'Rate. Earn. Lead.',
    description: 'You step into venues and call the vibe. Build clout, earn multipliers, and rank among the city\'s most trusted voices.',
    gradient: ['#FF3366', '#FF6B35'],
    accentColor: '#FF3366',
  },
  {
    key: 'insider',
    emoji: '🔭',
    label: 'Insider',
    subtitle: 'Know before you go.',
    description: 'You consume intel. Get scene reports, arrival windows, and demand signals — so you always pick the right move.',
    gradient: ['#9933FF', '#4169E1'],
    accentColor: '#9933FF',
  },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showCallName, setShowCallName] = useState(false);
  const [selectedMode, setSelectedMode] = useState<UserMode | null>(null);
  const [callNameInput, setCallNameInput] = useState('');
  const [savingCallName, setSavingCallName] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const { setUserMode, updateCallName } = require('../store/vibeStore').useVibeStore.getState();

  const handleNext = () => {
    if (currentIndex < pages.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowModeSelect(true);
    }
  };

  const handleModeConfirm = () => {
    const mode = selectedMode ?? 'scout';
    setUserMode(mode);
    setShowModeSelect(false);
    setShowCallName(true);
  };

  const handleCallNameConfirm = async () => {
    const name = callNameInput.trim();
    if (name.length > 0) {
      setSavingCallName(true);
      await updateCallName(name);
      setSavingCallName(false);
    }
    onComplete();
  };

  const renderPage = ({ item }: { item: OnboardingPage }) => (
    <View style={styles.page}>
      <View style={[styles.iconContainer, { shadowColor: item.accent }]}>
        <LinearGradient
          colors={[item.accent + '30', item.accent + '10']}
          style={styles.iconGradient}
        >
          <Ionicons name={item.icon} size={64} color={item.iconColor} />
        </LinearGradient>
      </View>
      <Text style={[styles.headline, { color: item.accent }]}>{item.headline}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  // ── Call Name Screen ─────────────────────────────────────────
  if (showCallName) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.centeredScreen}>
          <View style={callNameStyles.iconWrap}>
            <LinearGradient colors={['#9933FF30', '#9933FF10']} style={callNameStyles.iconGradient}>
              <Text style={callNameStyles.iconEmoji}>✦</Text>
            </LinearGradient>
          </View>

          <Text style={styles.screenTitle}>What do we{'\n'}call you?</Text>
          <Text style={styles.screenSubtitle}>
            Your name in the scene. Shown on your passport and the surge feed.
          </Text>

          <View style={callNameStyles.inputWrap}>
            <TextInput
              style={callNameStyles.input}
              placeholder="e.g. The Don, Yori, King Push"
              placeholderTextColor="#444"
              value={callNameInput}
              onChangeText={t => setCallNameInput(t.slice(0, 30))}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCallNameConfirm}
              selectionColor="#9933FF"
            />
            {callNameInput.length > 0 && (
              <Text style={callNameStyles.charCount}>{callNameInput.length}/30</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleCallNameConfirm}
            activeOpacity={0.8}
            style={{ width: '100%' }}
            disabled={savingCallName}
          >
            <LinearGradient
              colors={callNameInput.trim().length > 0 ? ['#9933FF', '#4169E1'] : ['#222', '#333']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>
                {savingCallName ? 'Saving...' : callNameInput.trim().length > 0 ? `Enter as ${callNameInput.trim()}` : 'Skip for now'}
              </Text>
              {!savingCallName && <Text style={{ fontSize: 18 }}>✦</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Mode Picker Screen ───────────────────────────────────────
  if (showModeSelect) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredScreen}>
          <Text style={styles.screenTitle}>How do you{'\n'}roll tonight?</Text>
          <Text style={styles.screenSubtitle}>This shapes your home experience. Switch anytime.</Text>

          <View style={{ width: '100%', gap: 14, marginBottom: 8, flex: 1, justifyContent: 'center' }}>
            {MODES.map((m) => {
              const isSelected = selectedMode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[modeStyles.card, isSelected && { borderColor: m.accentColor }]}
                  onPress={() => setSelectedMode(m.key)}
                  activeOpacity={0.8}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={m.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={modeStyles.cardInner}
                    >
                      <Text style={modeStyles.modeEmoji}>{m.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={modeStyles.labelRow}>
                          <Text style={modeStyles.modeLabel}>{m.label}</Text>
                          <Text style={modeStyles.modeSub}>{m.subtitle}</Text>
                        </View>
                        <Text style={modeStyles.modeDesc}>{m.description}</Text>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={[modeStyles.cardInner, modeStyles.cardInnerUnselected]}>
                      <Text style={modeStyles.modeEmoji}>{m.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={modeStyles.labelRow}>
                          <Text style={[modeStyles.modeLabel, { color: '#CCC' }]}>{m.label}</Text>
                          <Text style={modeStyles.modeSub}>{m.subtitle}</Text>
                        </View>
                        <Text style={modeStyles.modeDesc}>{m.description}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleModeConfirm}
            activeOpacity={0.8}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={selectedMode
                ? (MODES.find(m => m.key === selectedMode)?.gradient ?? ['#FF3366', '#FF6B35'])
                : ['#222', '#333']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>
                {selectedMode ? `Enter as ${MODES.find(m => m.key === selectedMode)?.label}` : 'Skip for now'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Info Slides ──────────────────────────────────────────────
  const isLastPage = currentIndex === pages.length - 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => setShowModeSelect(true)}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
      />

      <View style={styles.bottomSection}>
        <View style={styles.dotsContainer}>
          {pages.map((page, index) => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];
            const dotWidth   = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
            const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return (
              <Animated.View
                key={page.id}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: pages[currentIndex].accent }]}
              />
            );
          })}
        </View>

        {isLastPage ? (
          <TouchableOpacity onPress={handleNext} activeOpacity={0.8}>
            <LinearGradient
              colors={['#9933FF', '#4169E1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Choose your role</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.nextText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  iconContainer: {
    marginBottom: 40,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 10,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headline: {
    fontSize: 26,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
  },
  body: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: borderRadius.xl,
    gap: 8,
    width: SCREEN_WIDTH - 64,
  },
  ctaText: {
    color: '#FFF',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    width: SCREEN_WIDTH - 64,
  },
  nextText: {
    color: '#FFF',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  centeredScreen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
});

const modeStyles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  cardInnerUnselected: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modeEmoji: { fontSize: 38 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  modeLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  modeSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
  },
  modeDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 17,
  },
});

const callNameStyles = StyleSheet.create({
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 28,
    shadowColor: '#9933FF',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 46,
    color: '#9933FF',
  },
  inputWrap: {
    width: '100%',
    marginVertical: 24,
    position: 'relative',
  },
  input: {
    width: '100%',
    backgroundColor: '#111118',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#9933FF55',
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  charCount: {
    position: 'absolute',
    right: 14,
    bottom: -20,
    fontSize: 11,
    color: '#555',
  },
});
