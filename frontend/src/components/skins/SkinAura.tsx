/**
 * SkinAura — Organic morphing energy field.
 *
 * 8 control points orbit a center. Each oscillates radially at a unique
 * frequency, driven by a Reanimated clock. vibeScore sets the base radius;
 * surgeValue explosively expands the whole field.
 *
 * Path is a closed smooth cubic-bezier spline through the 8 points.
 * All math runs in useDerivedValue (UI thread).
 */
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Canvas, Group, Path, Circle, Skia, Paint, BlurMask } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SkinProps } from './skinTypes';

const { width: SCREEN_W } = Dimensions.get('window');
const W = SCREEN_W - 32;
const H = 220;
const CX = W / 2;
const CY = H / 2;
const N  = 8;

// Unique freq/phase per control point — makes shape feel alive
const FREQS  = [1.0, 1.3, 0.7, 1.6, 0.9, 1.2, 0.8, 1.5];
const PHASES = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6];

export default function SkinAura({ bpmShared, vibeScore, surgeValue, color }: SkinProps) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(withTiming(Math.PI * 2, { duration: 3000 }), -1, false);
  }, []);

  // Main aura path — smooth closed spline through 8 morphing control points
  const auraPath = useDerivedValue(() => {
    const baseR = (vibeScore.value / 100) * 80 + 30;
    const surge  = surgeValue.value;
    const pts: [number, number][] = [];

    for (let i = 0; i < N; i++) {
      const angle   = (i / N) * Math.PI * 2 - Math.PI / 2;
      const osc     = Math.sin(clock.value * FREQS[i] + PHASES[i]) * 22;
      const r       = (baseR + osc) * surge;
      pts.push([CX + Math.cos(angle) * r, CY + Math.sin(angle) * r]);
    }

    // Smooth closed cubic bezier spline (catmull-rom → bezier)
    const p = Skia.Path.Make();
    const tension = 0.4;
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % N];
      const p3 = pts[(i + 2) % N];
      const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
      const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
      const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
      const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
      p.cubicTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
    }
    p.close();
    return p;
  });

  // Glow path — slightly larger, low opacity
  const glowPath = useDerivedValue(() => {
    const baseR = (vibeScore.value / 100) * 80 + 44;
    const surge  = surgeValue.value;
    const pts: [number, number][] = [];

    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      const osc   = Math.sin(clock.value * FREQS[i] * 0.8 + PHASES[i] + 0.5) * 28;
      const r     = (baseR + osc) * surge;
      pts.push([CX + Math.cos(angle) * r, CY + Math.sin(angle) * r]);
    }

    const p = Skia.Path.Make();
    const tension = 0.4;
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % N];
      const p3 = pts[(i + 2) % N];
      const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
      const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
      const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
      const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
      p.cubicTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
    }
    p.close();
    return p;
  });

  const coreR = useDerivedValue(() => (vibeScore.value / 100) * 18 + 6);

  return (
    <View style={styles.wrapper}>
      <Canvas style={{ width: W, height: H }}>
        {/* Background */}
        <Circle cx={CX} cy={CY} r={W / 2} color="#050510" />

        {/* Outer glow */}
        <Path path={glowPath} color={color + '18'} style="fill">
          <Paint style="fill" color={color + '18'}>
            <BlurMask blur={24} style="solid" />
          </Paint>
        </Path>

        {/* Main aura fill */}
        <Path path={auraPath} color={color + '30'} style="fill" />

        {/* Aura stroke */}
        <Path path={auraPath} color={color} style="stroke" strokeWidth={1.5} />

        {/* Pulsing core */}
        <Circle cx={CX} cy={CY} r={coreR} color={color + '80'}>
          <Paint style="fill" color={color + '80'}>
            <BlurMask blur={8} style="solid" />
          </Paint>
        </Circle>
        <Circle cx={CX} cy={CY} r={5} color={color} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
});
