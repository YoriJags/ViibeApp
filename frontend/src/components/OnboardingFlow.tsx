/**
 * OnboardingFlow - Story-driven 4-screen onboarding
 * Narrative that teaches the app - inclusive of all live events & gatherings
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
    body: "Clubs. Restaurants. Concerts. Lounges. Anywhere people gather, there's an atmosphere worth knowing about.\n\nViibez shows you the real-time energy of every venue and event in your city.",
    accent: '#FF3366',
  },
  {
    id: '2',
    icon: 'pulse',
    iconColor: '#FF6B35',
    headline: 'Step in. Feel the room.\nShare it with the city.',
    body: "Rate the energy, the crowd, the door. Three taps and you've just updated the city's live pulse.\n\nEight visual skins — AURA, TERRAIN, MATRIX and more — show the crowd's energy in totally different ways.",
    accent: '#FF6B35',
  },
  {
    id: '3',
    icon: 'flash',
    iconColor: '#FFD700',
    headline: 'Your insight\nearns you Clout.',
    body: "Build rating streaks. Earn multipliers. Rise through Scout ranks from Newcomer to City Elite.\n\nHold IGNITE with other scouts to fire a synchronized flashlight moment — the crowd goes off together.",
    accent: '#FFD700',
  },
  {
    id: '4',
    icon: 'people',
    iconColor: '#00D4FF',
    headline: "Go out together.\nStay connected all night.",
    body: "Create a Cartel with your people. Vote on where to go. Find each other in any crowd with live location sharing.\n\nEvery great night is better when no one gets left behind.",
    accent: '#00D4FF',
  },
];

type VibePersona = 'turn_up' | 'grown_sexy' | 'culture' | 'chill_set';

const PERSONAS: { key: VibePersona; emoji: string; label: string; subtitle: string; gradient: [string, string] }[] = [
  { key: 'turn_up', emoji: '🎉', label: 'The Turn Up', subtitle: 'Clubs · Parties · High energy nights', gradient: ['#FF3366', '#9933FF'] },
  { key: 'grown_sexy', emoji: '🍸', label: 'The Luxe', subtitle: 'Lounges · Rooftops · Fine dining', gradient: ['#9933FF', '#4169E1'] },
  { key: 'culture', emoji: '🎵', label: 'The Culture', subtitle: 'Live music · Concerts · Art events', gradient: ['#FF9800', '#FFD700'] },
  { key: 'chill_set', emoji: '🌙', label: 'The Chill Set', subtitle: 'Restaurants · Cafes · Low-key spots', gradient: ['#00D4FF', '#00E676'] },
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
  const [showPersona, setShowPersona] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showCallName, setShowCallName] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<VibePersona | null>(null);
  const [selectedMode, setSelectedMode] = useState<UserMode | null>(null);
  const [callNameInput, setCallNameInput] = useState('');
  const [savingCallName, setSavingCallName] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Import store actions lazily to avoid circular deps
  const { setVibePersona, setUserMode, updateCallName } = require('../store/vibeStore').useVibeStore.getState();

  const handleNext = () => {
    if (currentIndex < pages.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last info page → show persona picker
      setShowPersona(true);
    }
  };

  const handlePersonaSelect = (persona: VibePersona) => {
    setSelectedPersona(persona);
  };

  const handlePersonaConfirm = () => {
    if (selectedPersona) {
      setVibePersona(selectedPersona);
    }
    // After persona, show mode picker
    setShowPersona(false);
    setShowModeSelect(true);
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

  // ── Persona Picker Screen ────────────────────────────────────
  if (showPersona) {
    return (
      <View style={styles.container}>
        <View style={styles.personaScreen}>
          <Text style={styles.personaTitle}>What kind of nights{'\n'}do you live for?</Text>
          <Text style={styles.personaSubtitle}>We'll personalise your experience. You can change this anytime.</Text>

          <View style={styles.personaGrid}>
            {PERSONAS.map((p) => {
              const isSelected = selectedPersona === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.personaCard, isSelected && styles.personaCardSelected]}
                  onPress={() => handlePersonaSelect(p.key)}
                  activeOpacity={0.8}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={p.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.personaCardGradient}
                    >
                      <Text style={styles.personaEmoji}>{p.emoji}</Text>
                      <Text style={styles.personaLabel}>{p.label}</Text>
                      <Text style={styles.personaCardSubtitle}>{p.subtitle}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.personaCardInner}>
                      <Text style={styles.personaEmoji}>{p.emoji}</Text>
                      <Text style={[styles.personaLabel, { color: '#CCC' }]}>{p.label}</Text>
                      <Text style={styles.personaCardSubtitle}>{p.subtitle}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handlePersonaConfirm}
            activeOpacity={0.8}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={selectedPersona
                ? (PERSONAS.find(p => p.key === selectedPersona)?.gradient ?? ['#FF3366', '#FF6B35'])
                : ['#333', '#444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>
                {selectedPersona ? "Let's Go" : 'Skip for now'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Call Name Screen ────────────────────────────────────────
  if (showCallName) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.personaScreen}>
          <View style={callNameStyles.iconWrap}>
            <LinearGradient colors={['#9933FF30', '#9933FF10']} style={callNameStyles.iconGradient}>
              <Text style={callNameStyles.iconEmoji}>✦</Text>
            </LinearGradient>
          </View>

          <Text style={styles.personaTitle}>What do we{'\n'}call you?</Text>
          <Text style={styles.personaSubtitle}>
            Your name in the scene. Shown on your passport, the leaderboard, and the surge feed.
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
              colors={callNameInput.trim().length > 0 ? ['#9933FF', '#4169E1'] : ['#333', '#444']}
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

  // ── Mode Picker Screen ──────────────────────────────────────
  if (showModeSelect) {
    return (
      <View style={styles.container}>
        <View style={styles.personaScreen}>
          <Text style={styles.personaTitle}>How do you{'\n'}roll tonight?</Text>
          <Text style={styles.personaSubtitle}>This shapes your home experience. You can switch anytime.</Text>

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
                : ['#333', '#444']}
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

  // ── Info Pages ───────────────────────────────────────────────
  const isLastPage = currentIndex === pages.length - 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => setShowPersona(true)}>
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
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
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
              colors={['#FF3366', '#FF6B35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Almost Done</Text>
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
  // Persona screen styles
  personaScreen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 12,
  },
  personaTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  personaSubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  personaGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  personaCard: {
    width: '47%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  personaCardSelected: {
    borderColor: 'transparent',
  },
  personaCardGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
    minHeight: 120,
    justifyContent: 'center',
  },
  personaCardInner: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
    minHeight: 120,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  personaEmoji: {
    fontSize: 32,
  },
  personaLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  personaCardSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 14,
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
  modeEmoji: {
    fontSize: 38,
  },
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
