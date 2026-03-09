/**
 * NightArcStrip — Tonight's journey arc.
 * 5 milestones to complete for a full night out.
 * Drives check-ins, ratings, and crew activity.
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  hasSetMood: boolean;
  hasRatedVenue: boolean;
  hasCheckedIn: boolean;
  hasCrewActive: boolean;
  onStepPress: (step: string) => void;
}

interface Step {
  id: string;
  label: string;
  icon: string;
  done: boolean;
}

export default function NightArcStrip({
  hasSetMood,
  hasRatedVenue,
  hasCheckedIn,
  hasCrewActive,
  onStepPress,
}: Props) {
  const steps: Step[] = [
    { id: 'mood',    label: 'Set the Mood',  icon: 'color-palette', done: hasSetMood    },
    { id: 'explore', label: 'Explore',       icon: 'compass',       done: true           },
    { id: 'rate',    label: 'Rate a Spot',   icon: 'star',          done: hasRatedVenue  },
    { id: 'checkin', label: 'Check In',      icon: 'location',      done: hasCheckedIn   },
    { id: 'crew',    label: 'Roll Deep',     icon: 'people',        done: hasCrewActive  },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;
  const currentStep = steps.find(s => !s.done) ?? null;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  // Animate progress bar on mount/change
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: completedCount / steps.length,
      tension: 60,
      friction: 10,
      useNativeDriver: false, // animating width (layout)
    }).start();
  }, [completedCount]);

  // Pulse loop for current step border
  useEffect(() => {
    if (allDone) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [allDone]);

  return (
    <View style={styles.card}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>TONIGHT'S ARC</Text>
        <Text style={[styles.count, allDone && styles.countDone]}>
          {completedCount}/5
        </Text>
      </View>

      {/* All done banner */}
      {allDone && (
        <LinearGradient
          colors={['#FF336615', '#9933FF15']}
          style={styles.allDoneBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.allDoneText}>ARC COMPLETE 🔥</Text>
        </LinearGradient>
      )}

      {/* Steps row */}
      <View style={styles.stepsRow}>
        {steps.map((step, idx) => {
          const isDone = step.done;
          const isCurrent = !isDone && (idx === 0 || steps[idx - 1].done);

          return (
            <React.Fragment key={step.id}>
              {/* Connector line before (except first) */}
              {idx > 0 && (
                <View
                  style={[
                    styles.connector,
                    steps[idx - 1].done && { backgroundColor: '#FF336630' },
                  ]}
                />
              )}

              <TouchableOpacity
                style={styles.stepWrapper}
                onPress={() => onStepPress(step.id)}
                activeOpacity={0.75}
              >
                {/* Circle */}
                {isDone ? (
                  <LinearGradient
                    colors={['#FF3366', '#9933FF']}
                    style={styles.stepCircle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={step.icon as any} size={18} color="#FFF" />
                  </LinearGradient>
                ) : isCurrent ? (
                  <Animated.View
                    style={[
                      styles.stepCircle,
                      styles.stepCircleCurrent,
                      { opacity: pulseAnim },
                    ]}
                  >
                    <Ionicons name={step.icon as any} size={18} color="#FF3366" />
                  </Animated.View>
                ) : (
                  <View style={[styles.stepCircle, styles.stepCirclePending]}>
                    <Ionicons name={step.icon as any} size={18} color="#222236" />
                  </View>
                )}

                {/* Label */}
                <Text
                  style={[
                    styles.stepLabel,
                    isDone    && styles.stepLabelDone,
                    isCurrent && styles.stepLabelCurrent,
                    !isDone && !isCurrent && styles.stepLabelPending,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={['#FF3366', '#9933FF']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>

      {/* Next step CTA */}
      {!allDone && currentStep && (
        <TouchableOpacity
          style={styles.nextStepCta}
          onPress={() => onStepPress(currentStep.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.nextStepText}>
            Next: {currentStep.label}  →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#07070F',
    borderWidth: 1,
    borderColor: '#111120',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    gap: 12,
  },

  // Title row
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#2A2A4A',
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A2A4A',
  },
  countDone: {
    color: '#FF3366',
  },

  // All done banner
  allDoneBanner: {
    borderWidth: 1,
    borderColor: '#FF336630',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  allDoneText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FF3366',
    letterSpacing: 1,
  },

  // Steps
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connector: {
    flex: 1,
    height: 1,
    backgroundColor: '#0E0E1C',
  },
  stepWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCurrent: {
    backgroundColor: '#FF336610',
    borderWidth: 1.5,
    borderColor: '#FF3366',
  },
  stepCirclePending: {
    backgroundColor: '#0C0C18',
    borderWidth: 1,
    borderColor: '#1A1A28',
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 52,
  },
  stepLabelDone:    { color: '#666' },
  stepLabelCurrent: { color: '#FF3366' },
  stepLabelPending: { color: '#1A1A28' },

  // Progress bar
  progressTrack: {
    height: 2,
    backgroundColor: '#0E0E1C',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },

  // Next step CTA
  nextStepCta: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  nextStepText: {
    fontSize: 11,
    color: '#2A2A4A',
    fontWeight: '600',
  },
});
