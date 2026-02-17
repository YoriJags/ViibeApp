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
    headline: "Where's the energy\nright now?",
    body: "Clubs. Concerts. Church. Block parties. Raves. Anywhere people gather, there's a vibe.\n\nVibe Scout shows you the real-time energy of every event and venue in your city.",
    accent: '#FF3366',
  },
  {
    id: '2',
    icon: 'pulse',
    iconColor: '#FF6B35',
    headline: 'Walk in. Feel the vibe.\nNow you can measure it.',
    body: "Rate the energy, the crowd, the gate. Three taps and you've just updated the city's pulse.\n\nEvery rating makes the map smarter for everyone.",
    accent: '#FF6B35',
  },
  {
    id: '3',
    icon: 'flash',
    iconColor: '#FFD700',
    headline: 'Your ratings earn Clout.',
    body: "Build streaks. Earn multipliers. Rise from Newbie to Elite Scout.\n\nThe city listens to the scouts who show up. That's you.",
    accent: '#FFD700',
  },
  {
    id: '4',
    icon: 'people',
    iconColor: '#00D4FF',
    headline: "Squad up.\nSee who's already there.",
    body: "Create a crew. Vote on where to go. Ghost check-in to let people know you're in the building.\n\nEvery gathering is better together.",
    accent: '#00D4FF',
  },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < pages.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const renderPage = ({ item, index }: { item: OnboardingPage; index: number }) => (
    <View style={styles.page}>
      {/* Icon */}
      <View style={[styles.iconContainer, { shadowColor: item.accent }]}>
        <LinearGradient
          colors={[item.accent + '30', item.accent + '10']}
          style={styles.iconGradient}
        >
          <Ionicons name={item.icon} size={64} color={item.iconColor} />
        </LinearGradient>
      </View>

      {/* Headline */}
      <Text style={[styles.headline, { color: item.accent }]}>{item.headline}</Text>

      {/* Body */}
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  const isLastPage = currentIndex === pages.length - 1;

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Pages */}
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

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Dots */}
        <View style={styles.dotsContainer}>
          {pages.map((page, index) => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={page.id}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: pages[currentIndex].accent,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* CTA Button */}
        {isLastPage ? (
          <TouchableOpacity onPress={onComplete} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FF3366', '#FF6B35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Enter the Vibe</Text>
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
});
