/**
 * SkinMatrix — Falling crowd-data stream.
 *
 * 14 columns of falling symbols. Drop speed = vibeScore-driven.
 * Characters drawn as thin rects (performance-safe, no font loading needed).
 * surgeValue dramatically accelerates the fall and brightens the stream.
 */
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Canvas, Rect, Path, Skia } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SkinProps } from './skinTypes';

const { width: SCREEN_W } = Dimensions.get('window');
const W        = SCREEN_W - 32;
const H        = 200;
const COLS     = 14;
const COL_W    = W / COLS;
const CHAR_H   = 14;
const CHARS_PER_COL = Math.ceil(H / CHAR_H) + 2;

// Deterministic column offsets so columns start at different heights
const COL_OFFSETS = Array.from({ length: COLS }, (_, i) =>
  ((i * 137.508) % 1) * H
);
// Column speeds (relative multipliers, 0.7–1.3)
const COL_SPEEDS = Array.from({ length: COLS }, (_, i) =>
  0.7 + ((i * 53.7) % 1) * 0.6
);
// Column char pattern widths (simulate symbol variety)
const CHAR_WIDTHS = Array.from({ length: COLS }, (_, i) => [4, 6, 8, 5, 7][i % 5]);

export default function SkinMatrix({ vibeScore, surgeValue, color }: SkinProps) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(withTiming(H, { duration: 1600 }), -1, false);
  }, []);

  // Surge: surgeValue peaks at 1.8. Use it directly as speed multiplier (2× at peak)
  // Gold toggle: surgeValue > 1.3 → gold mode
  const surgeIntensity = useDerivedValue(() => Math.max(0, (surgeValue.value - 1.0) / 0.8));

  const matrixPath = useDerivedValue(() => {
    const surge     = surgeValue.value;           // speed multiplier
    const intensity = (vibeScore.value / 100);
    const tick      = clock.value * surge;        // faster fall during surge
    const p         = Skia.Path.Make();

    for (let col = 0; col < COLS; col++) {
      const cx     = col * COL_W + COL_W / 2 - CHAR_WIDTHS[col] / 2;
      const speed  = COL_SPEEDS[col];
      const offset = COL_OFFSETS[col];
      const chars  = Math.round(intensity * CHARS_PER_COL * 0.8 + 2);

      for (let row = 0; row < chars; row++) {
        const y = ((tick * speed + offset + row * CHAR_H) % H + H) % H;
        const charW = CHAR_WIDTHS[col];
        const charH = CHAR_H - 3;
        // Each "character" is a small rect
        p.addRect(Skia.XYWHRect(cx, y, charW, charH));
      }
    }
    return p;
  });

  // Gold path — same as matrixPath but rendered gold at surge
  const goldPath = useDerivedValue(() => {
    const surge     = surgeValue.value;
    const intensity = vibeScore.value / 100;
    const tick      = clock.value * surge;
    const p         = Skia.Path.Make();
    for (let col = 0; col < COLS; col++) {
      const cx     = col * COL_W + COL_W / 2 - CHAR_WIDTHS[col] / 2;
      const speed  = COL_SPEEDS[col];
      const offset = COL_OFFSETS[col];
      const chars  = Math.round(intensity * CHARS_PER_COL * 0.8 + 2);
      for (let row = 0; row < chars; row++) {
        const y = ((tick * speed + offset + row * CHAR_H) % H + H) % H;
        p.addRect(Skia.XYWHRect(cx, y, CHAR_WIDTHS[col], CHAR_H - 3));
      }
    }
    return p;
  });

  // Head of each stream — bright leading char
  const headPath = useDerivedValue(() => {
    const surge  = surgeValue.value;
    const tick   = clock.value * surge;
    const p      = Skia.Path.Make();

    for (let col = 0; col < COLS; col++) {
      const cx     = col * COL_W + COL_W / 2 - CHAR_WIDTHS[col] / 2;
      const speed  = COL_SPEEDS[col];
      const offset = COL_OFFSETS[col];
      const y      = ((tick * speed + offset) % H + H) % H;
      p.addRect(Skia.XYWHRect(cx, y, CHAR_WIDTHS[col], CHAR_H - 2));
    }
    return p;
  });

  return (
    <View style={styles.wrapper}>
      <Canvas style={{ width: W, height: H }}>
        {/* Background */}
        <Rect x={0} y={0} width={W} height={H} color="#020802" />

        {/* Normal stream — fades out during surge */}
        <Path path={matrixPath} color={color + '70'} style="fill" opacity={useDerivedValue(() => 1 - surgeIntensity.value)} />

        {/* Gold surge stream — fades in during surge */}
        <Path path={goldPath} color="#FFD70099" style="fill" opacity={surgeIntensity} />

        {/* Bright head chars — gold during surge */}
        <Path path={headPath} color={color} style="fill" opacity={useDerivedValue(() => 1 - surgeIntensity.value)} />
        <Path path={headPath} color="#FFD700" style="fill" opacity={surgeIntensity} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ wrapper: { alignItems: 'center' } });
