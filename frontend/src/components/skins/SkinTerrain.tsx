/**
 * SkinTerrain — Mountain ridge silhouette.
 *
 * Maintains a rolling 60-point history of vibeScore values.
 * Each tick shifts the array left and appends a new value (vibeScore + noise).
 * Rendered as a filled Skia path with a gradient-style color.
 * Surge event causes a dramatic spike in the ridge.
 */
import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia, Rect } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming, runOnJS } from 'react-native-reanimated';
import { SkinProps } from './skinTypes';

const { width: SCREEN_W } = Dimensions.get('window');
const W        = SCREEN_W - 32;
const H        = 200;
const POINTS   = 50;
const STEP     = W / (POINTS - 1);

function genInitial(score: number): number[] {
  return Array.from({ length: POINTS }, (_, i) => {
    const noise = Math.sin(i * 0.4) * 15 + Math.sin(i * 1.1) * 8;
    return Math.max(10, Math.min(H - 10, H - (score / 100) * (H * 0.65) - noise));
  });
}

export default function SkinTerrain({ bpmShared, vibeScore, surgeValue, color }: SkinProps) {
  const historyRef = useRef<number[]>(genInitial(vibeScore.value));
  const noise      = useSharedValue(0);
  const tickPath   = useSharedValue(Skia.Path.Make());

  // Noise clock — drives organic terrain ripple
  useEffect(() => {
    noise.value = withRepeat(withTiming(Math.PI * 4, { duration: 4000 }), -1, false);
  }, []);

  const updateHistory = () => {
    const h    = historyRef.current;
    const base = H - (vibeScore.value / 100) * (H * 0.70);
    const n    = Math.sin(Date.now() / 400) * 12 + Math.sin(Date.now() / 180) * 6;
    const next = Math.max(8, Math.min(H - 8, base + n));
    historyRef.current = [...h.slice(1), next];
  };

  // Build path from history every noise tick
  // Surge intensity: 0 at rest, peaks at 0.8 during surge (surgeValue goes 1→1.8→1)
  const surgeIntensity = useDerivedValue(() => Math.max(0, (surgeValue.value - 1.0) / 0.8));

  const buildRidge = (amplitudeMultiplier: number, xOffset: number) => {
    const pts = historyRef.current;
    const p   = Skia.Path.Make();
    p.moveTo(xOffset, pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = i * STEP + xOffset;
      const y1 = pts[i] * amplitudeMultiplier;
      const x2 = (i + 1) * STEP + xOffset;
      const y2 = pts[i + 1] * amplitudeMultiplier;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      p.quadTo(x1, y1, mx, my);
    }
    p.lineTo((pts.length - 1) * STEP + xOffset, pts[pts.length - 1] * amplitudeMultiplier);
    return p;
  };

  const terrainPath = useDerivedValue(() => {
    const _ = noise.value;
    runOnJS(updateHistory)();
    const surge = surgeValue.value;
    const pts = historyRef.current;
    const p   = Skia.Path.Make();
    p.moveTo(0, H);
    p.lineTo(0, pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = i * STEP;
      const y1 = pts[i] / surge;        // surge pulls ridge UP (lower Y = higher on screen)
      const x2 = (i + 1) * STEP;
      const y2 = pts[i + 1] / surge;
      p.quadTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    p.lineTo(W, pts[pts.length - 1] / surge);
    p.lineTo(W, H);
    p.close();
    return p;
  });

  // Ridge main + chromatic aberration: red shifted right, cyan shifted left
  const ridgeMain = useDerivedValue(() => {
    const _ = noise.value;
    const surge = surgeValue.value;
    const pts = historyRef.current;
    const p = Skia.Path.Make();
    p.moveTo(0, pts[0] / surge);
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = i * STEP; const y1 = pts[i] / surge;
      const x2 = (i + 1) * STEP; const y2 = pts[i + 1] / surge;
      p.quadTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    p.lineTo(W, pts[pts.length - 1] / surge);
    return p;
  });

  // Chromatic channels — offset X by surge-scaled amount
  const ridgeRed = useDerivedValue(() => {
    const _ = noise.value;
    const surge = surgeValue.value;
    const offset = surgeIntensity.value * 5;  // 0→5px at full surge
    const pts = historyRef.current;
    const p = Skia.Path.Make();
    p.moveTo(offset, pts[0] / surge);
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = i * STEP + offset; const y1 = pts[i] / surge;
      const x2 = (i + 1) * STEP + offset; const y2 = pts[i + 1] / surge;
      p.quadTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    p.lineTo(W + offset, pts[pts.length - 1] / surge);
    return p;
  });

  const ridgeCyan = useDerivedValue(() => {
    const _ = noise.value;
    const surge = surgeValue.value;
    const offset = -surgeIntensity.value * 5;
    const pts = historyRef.current;
    const p = Skia.Path.Make();
    p.moveTo(offset, pts[0] / surge);
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = i * STEP + offset; const y1 = pts[i] / surge;
      const x2 = (i + 1) * STEP + offset; const y2 = pts[i + 1] / surge;
      p.quadTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    p.lineTo(W + offset, pts[pts.length - 1] / surge);
    return p;
  });

  const chromaOpacity = useDerivedValue(() => surgeIntensity.value * 0.7);

  return (
    <View style={styles.wrapper}>
      <Canvas style={{ width: W, height: H }}>
        <Rect x={0} y={0} width={W} height={H} color="#030808" />
        <Path path={terrainPath} color={color + '20'} style="fill" />

        {/* Chromatic aberration — red channel right */}
        <Path path={ridgeRed}  color="#FF334488" style="stroke" strokeWidth={1.5} strokeCap="round" opacity={chromaOpacity} />
        {/* Chromatic aberration — cyan channel left */}
        <Path path={ridgeCyan} color="#00FFFF66" style="stroke" strokeWidth={1.5} strokeCap="round" opacity={chromaOpacity} />
        {/* Main ridge */}
        <Path path={ridgeMain} color={color} style="stroke" strokeWidth={2} strokeCap="round" />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ wrapper: { alignItems: 'center' } });
