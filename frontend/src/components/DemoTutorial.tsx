/**
 * DemoTutorial — Full-app guided walkthrough for Demo Mode.
 * 11-step cross-screen tutorial that navigates between all major features.
 * Mounted at root layout level; uses Modal portal to float above everything.
 * Visual style mirrors the admin walkthrough (neon pink adaptation).
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';

// ─── Step Definitions ───────────────────────────────────────────────
interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  targetRoute: string;
  position: 'top' | 'center' | 'bottom';
  gradientColors: [string, string];
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to VIIBE',
    description:
      "Live human energy, measured. Scouts rate venues from inside the room, so you always know where the city is alive right now. Here's the tour.",
    icon: 'sparkles',
    targetRoute: '/(public)',
    position: 'center',
    gradientColors: ['#FF4D00', '#FFB300'],
  },
  {
    id: 'tonight-hero',
    title: 'Where Lagos is alive',
    description:
      "The map opens on the live energy of the city, pulse score, the venue leading tonight, and how fast the room is heating up.",
    icon: 'flame',
    targetRoute: '/(public)',
    position: 'center',
    gradientColors: ['#FF4D00', '#FFB300'],
  },
  {
    id: 'venue-detail',
    title: 'Read the room',
    description:
      "Open any venue for its live energy, scout consensus, capacity, the door, and a short forecast of where it's headed.",
    icon: 'pulse',
    targetRoute: '/venue/demo_venue_quilox',
    position: 'center',
    gradientColors: ['#E85D00', '#FFB300'],
  },
  {
    id: 'reactor',
    title: 'Charge the room',
    description:
      "Inside a venue, tap the reactor to add to its live charge. Enough verified scouts in the room together push it toward ELECTRIC.",
    icon: 'flash',
    targetRoute: '/venue/demo_venue_quilox',
    position: 'center',
    gradientColors: ['#FF4D00', '#FFF3D6'],
  },
  {
    id: 'rate',
    title: 'Call the vibe',
    description:
      "Three quick questions, energy, crowd, door wait. Your rating updates every scout in the city the moment you submit.",
    icon: 'star',
    targetRoute: '/venue/demo_venue_quilox',
    position: 'center',
    gradientColors: ['#FFB300', '#FFF3D6'],
  },
  {
    id: 'profile',
    title: 'Your scout profile',
    description:
      'Track your clout, scout tier, and streak. The more accurate your calls, the more your signal is trusted.',
    icon: 'person',
    targetRoute: '/(public)/profile',
    position: 'top',
    gradientColors: ['#FF4D00', '#FFB300'],
  },
  {
    id: 'complete',
    title: "You're all set",
    description:
      "Explore freely in Demo Mode, all data is simulated. Toggle demo off from the Profile screen when you're ready for the live city.",
    icon: 'checkmark-circle',
    targetRoute: '/(public)',
    position: 'center',
    gradientColors: ['#FF4D00', '#FFF3D6'],
  },
];

// ─── Floor helpers ──────────────────────────────────────────────────
const FLOORS = ['/(public)', '/(merchant)', '/(admin)'];

function getFloor(route: string): string | null {
  return FLOORS.find((f) => route.startsWith(f)) || null;
}

function isVenueDetail(route: string): boolean {
  return route.startsWith('/venue/');
}

// ─── Component ──────────────────────────────────────────────────────
export default function DemoTutorial() {
  const router = useRouter();
  const { isDemoMode, hasSeenDemoTutorial, completeDemoTutorial } =
    useVibeStore();

  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Auto-trigger on first demo mode activation
  useEffect(() => {
    if (isDemoMode && !hasSeenDemoTutorial) {
      const timer = setTimeout(() => {
        setCurrentStep(0);
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    if (!isDemoMode) {
      setIsVisible(false);
    }
  }, [isDemoMode, hasSeenDemoTutorial]);

  // Spotlight pulse animation
  useEffect(() => {
    if (isVisible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isVisible]);

  // ─── Navigation logic ─────────────────────────────────────────────
  const navigateToRoute = useCallback(
    (targetRoute: string, currentRoute: string) => {
      if (targetRoute === currentRoute) return;

      setIsNavigating(true);

      const targetFloor = getFloor(targetRoute);
      const currentFloor = getFloor(currentRoute);

      if (isVenueDetail(targetRoute)) {
        router.push(targetRoute as any);
      } else if (targetFloor && currentFloor && targetFloor !== currentFloor) {
        // Cross-floor: use replace (matches FloorSwitcher)
        router.replace(targetRoute as any);
      } else {
        router.push(targetRoute as any);
      }

      setTimeout(() => setIsNavigating(false), 800);
    },
    [router],
  );

  const popVenueDetailIfNeeded = useCallback(
    (currentRoute: string): boolean => {
      if (isVenueDetail(currentRoute)) {
        router.back();
        return true;
      }
      return false;
    },
    [router],
  );

  // ─── Step handlers ────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (currentStep >= STEPS.length - 1) {
      // Final step → complete
      completeDemoTutorial();
      setIsVisible(false);
      router.replace('/(public)' as any);
      return;
    }

    const nextIndex = currentStep + 1;
    const currentRoute = STEPS[currentStep].targetRoute;
    const nextRoute = STEPS[nextIndex].targetRoute;

    if (currentRoute === nextRoute) {
      setCurrentStep(nextIndex);
      return;
    }

    // If leaving venue detail, pop it first then navigate
    if (isVenueDetail(currentRoute) && !isVenueDetail(nextRoute)) {
      router.back();
      setIsNavigating(true);
      setTimeout(() => {
        navigateToRoute(nextRoute, getFloor(currentRoute) || '/(public)');
        setCurrentStep(nextIndex);
      }, 400);
    } else {
      navigateToRoute(nextRoute, currentRoute);
      setCurrentStep(nextIndex);
    }
  }, [currentStep, navigateToRoute, popVenueDetailIfNeeded, completeDemoTutorial, router]);

  const handlePrev = useCallback(() => {
    if (currentStep <= 0) return;

    const prevIndex = currentStep - 1;
    const currentRoute = STEPS[currentStep].targetRoute;
    const prevRoute = STEPS[prevIndex].targetRoute;

    if (currentRoute === prevRoute) {
      setCurrentStep(prevIndex);
      return;
    }

    // If on venue detail, pop it
    if (isVenueDetail(currentRoute) && !isVenueDetail(prevRoute)) {
      router.back();
      setCurrentStep(prevIndex);
      return;
    }

    navigateToRoute(prevRoute, currentRoute);
    setCurrentStep(prevIndex);
  }, [currentStep, navigateToRoute, router]);

  const handleSkip = useCallback(() => {
    completeDemoTutorial();
    setIsVisible(false);
    // Navigate back to public floor
    const currentRoute = STEPS[currentStep].targetRoute;
    if (isVenueDetail(currentRoute)) {
      router.back();
      setTimeout(() => router.replace('/(public)' as any), 300);
    } else if (getFloor(currentRoute) !== '/(public)') {
      router.replace('/(public)' as any);
    }
  }, [completeDemoTutorial, currentStep, router]);

  // Don't render anything if not visible
  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={s.overlay}>
        {isNavigating ? (
          <ActivityIndicator size="large" color="#FF3366" />
        ) : (
          <>
            {/* Spotlight ring */}
            <Animated.View
              style={[
                s.spotlightContainer,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={s.spotlightRing} />
            </Animated.View>

            {/* Tooltip card */}
            <View
              style={[
                s.card,
                step.position === 'top' && s.cardTop,
                step.position === 'bottom' && s.cardBottom,
              ]}
            >
              {/* Progress dots */}
              <View style={s.dots}>
                {STEPS.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      s.dot,
                      idx === currentStep && s.dotActive,
                      idx < currentStep && s.dotCompleted,
                    ]}
                  />
                ))}
              </View>

              {/* Icon */}
              <View style={s.iconWrap}>
                <LinearGradient
                  colors={step.gradientColors}
                  style={s.iconGradient}
                >
                  <Ionicons name={step.icon} size={32} color="#FFF" />
                </LinearGradient>
              </View>

              {/* Content */}
              <Text style={s.title}>{step.title}</Text>
              <Text style={s.description}>{step.description}</Text>
              <Text style={s.counter}>
                Step {currentStep + 1} of {STEPS.length}
              </Text>

              {/* Navigation */}
              <View style={s.nav}>
                {isFirstStep ? (
                  <TouchableOpacity
                    style={s.skipBtn}
                    onPress={handleSkip}
                  >
                    <Text style={s.skipText}>Skip Tour</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.backBtn}
                    onPress={handlePrev}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color="#B0B0B0"
                    />
                    <Text style={s.backText}>Back</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={s.nextBtn}
                  onPress={handleNext}
                >
                  <Text style={s.nextText}>
                    {isLastStep ? 'Get Started' : 'Next'}
                  </Text>
                  <Ionicons
                    name={isLastStep ? 'checkmark' : 'chevron-forward'}
                    size={18}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles (neon pink adaptation of admin walkthrough) ─────────────
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  spotlightContainer: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
  },
  spotlightRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF3366',
    backgroundColor: 'rgba(255,51,102,0.1)',
  },

  // Card
  card: {
    backgroundColor: '#151520',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  cardTop: {
    marginTop: 'auto',
    marginBottom: 100,
  },
  cardBottom: {
    marginTop: 100,
    marginBottom: 'auto',
  },

  // Progress dots
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E1E2E',
  },
  dotActive: {
    backgroundColor: '#FF3366',
    width: 20,
  },
  dotCompleted: {
    backgroundColor: '#00E676',
  },

  // Icon
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Text
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  counter: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Nav
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 4,
  },
  backText: {
    fontSize: 14,
    color: '#B0B0B0',
    fontWeight: '500',
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
