/**
 * MerchantOnboarding - 3-step spotlight walkthrough
 * Overlays the merchant dashboard to highlight key sections
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, borderRadius, typography } from '../theme/floors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const { colors } = merchantTheme;

interface MerchantOnboardingProps {
  visible: boolean;
  onComplete: () => void;
}

interface Step {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  position: 'top' | 'middle' | 'bottom';
}

const steps: Step[] = [
  {
    icon: 'pulse',
    iconColor: '#FF3366',
    title: 'Your Vibe Score',
    description: "This is your venue's energy right now, measured by real scouts on the ground. The higher it goes, the more visible you become on the city map.",
    position: 'top',
  },
  {
    icon: 'flash',
    iconColor: '#FFD700',
    title: 'Pulse Drops',
    description: "Amplify your signal to the whole city. Drop a Pulse and scouts earn 2x Clout at your venue — bringing more traffic through your door.",
    position: 'middle',
  },
  {
    icon: 'megaphone',
    iconColor: '#00D4FF',
    title: 'Energy Campaigns',
    description: "Launch campaigns that multiply the Clout scouts earn at your venue. The more energy you generate, the more the city talks about you.",
    position: 'bottom',
  },
];

export default function MerchantOnboarding({ visible, onComplete }: MerchantOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!visible) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i === currentStep && styles.stepDotActive,
                i < currentStep && styles.stepDotComplete,
              ]}
            />
          ))}
        </View>

        {/* Content card */}
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: step.iconColor + '20' }]}>
            <Ionicons name={step.icon} size={36} color={step.iconColor} />
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.buttonRow}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setCurrentStep(currentStep - 1)}
              >
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextButton, isLast && styles.doneButton]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={[styles.nextText, isLast && styles.doneText]}>
                {isLast ? "Got it, let's go!" : 'Next'}
              </Text>
              {!isLast && <Ionicons name="arrow-forward" size={16} color={colors.gold} />}
            </TouchableOpacity>
          </View>

          {/* Skip */}
          <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
            <Text style={styles.skipText}>Skip walkthrough</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  stepDotActive: {
    backgroundColor: colors.gold,
    width: 24,
  },
  stepDotComplete: {
    backgroundColor: colors.primary,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xxl,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gold + '20',
    borderWidth: 1,
    borderColor: colors.gold + '40',
    gap: 6,
  },
  nextText: {
    color: colors.gold,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  doneButton: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  doneText: {
    color: '#000',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
  },
});
