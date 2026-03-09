/**
 * LastCallStrip — appears after 1:30 AM when venues are still peaking.
 * Pulsing urgency strip docked above the tab bar.
 * "It's 2AM. 3 spots still PEAK. You sure you're going home?"
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Props {
  peakCount: number;       // number of venues still at peak/lit
  onPress: () => void;     // navigate to explore
  onDismiss: () => void;
}

export default function LastCallStrip({ peakCount, onPress, onDismiss }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideY    = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    // Slide up
    Animated.spring(slideY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Pulse loop
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const timeStr = `${hour % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${hour >= 12 ? 'AM' : 'PM'}`;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: slideY }] }]}>
      <LinearGradient
        colors={['#1A0010', '#0A0A0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.strip}
      >
        {/* Pulse dot */}
        <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />

        <View style={styles.textBlock}>
          <Text style={styles.timeText}>LAST CALL · {timeStr}</Text>
          <Text style={styles.bodyText}>
            {peakCount} {peakCount === 1 ? 'spot is' : 'spots are'} still PEAK. You sure you're going home?
          </Text>
        </View>

        <TouchableOpacity style={styles.goBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.8}>
          <Text style={styles.goBtnText}>GO</Text>
          <Ionicons name="arrow-forward" size={12} color="#FF3366" />
        </TouchableOpacity>

        <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
          <Ionicons name="close" size={14} color="#444" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 999,
  },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#FF336622',
  },
  pulseDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3366',
    shadowColor: '#FF3366', shadowOpacity: 0.8, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  textBlock: { flex: 1 },
  timeText: { fontSize: 8, fontWeight: '900', color: '#FF3366', letterSpacing: 2, marginBottom: 2 },
  bodyText: { fontSize: 12, color: '#999', fontWeight: '500', lineHeight: 16 },
  goBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#FF336644', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  goBtnText: { color: '#FF3366', fontSize: 11, fontWeight: '800' },
  closeBtn: { padding: 4 },
});
