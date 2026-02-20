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
    body: "Clubs. Restaurants. Concerts. Lounges. Anywhere people gather, there's an atmosphere worth knowing about.\n\nVibez shows you the real-time energy of every venue and event in your city.",
    accent: '#FF3366',
  },
  {
    id: '2',
    icon: 'pulse',
    iconColor: '#FF6B35',
    headline: 'Step in. Feel the room.\nShare it with the city.',
    body: "Rate the energy, the crowd, the door. Three taps and you've just updated the city's live pulse.\n\nEvery rating helps thousands of people make better decisions tonight.",
    accent: '#FF6B35',
  },
  {
    id: '3',
    icon: 'flash',
    iconColor: '#FFD700',
    headline: 'Your insight\nearns you Clout.',
    body: "Build rating streaks. Earn multipliers. Rise through Scout ranks from Newcomer to City Elite.\n\nThe most trusted voices shape where the city goes. Yours could be one of them.",
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

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPersona, setShowPersona] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<VibePersona | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Import store action lazily to avoid circular deps
  const { setVibePersona } = require('../store/vibeStore').useVibeStore.getState();

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
