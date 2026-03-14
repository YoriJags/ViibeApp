/**
 * SkinRadar — Classic radar sweep with scout blips.
 *
 * A rotating sweep arm scans the circle. Blips appear at random positions
 * as the sweep passes nearby. Blip opacity fades as the sweep moves away.
 * vibeScore controls blip density. surgeValue expands the radar range.
 */
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path, Skia, Group, Paint, BlurMask } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SkinProps } from './skinTypes';

const { width: SCREEN_W } = Dimensions.get('window');
const W   = SCREEN_W - 32;
const H   = 220;
const CX  = W / 2;
const CY  = H / 2;
const MAX_R = Math.min(CX, CY) - 12;

// Seeded blip positions (deterministic)
function genBlips(count: number) {
  const blips = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.sin(i * 137.5) * 2;
    const r     = (0.3 + (Math.abs(Math.sin(i * 1.7)) * 0.65)) * MAX_R;
    blips.push({ angle, r });
  }
  return blips;
}

const BLIP_POSITIONS = genBlips(12);
const RING_RADII     = [MAX_R * 0.33, MAX_R * 0.66, MAX_R];

export default function SkinRadar({ vibeScore, surgeValue, color }: SkinProps) {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(Math.PI * 2, { duration: 3000 }), -1, false);
  }, []);

  // Sweep arm path (thin sector)
  const sweepPath = useDerivedValue(() => {
    const r     = MAX_R * Math.min(surgeValue.value, 1.3);
    const angle = sweep.value - Math.PI / 2;
    const p     = Skia.Path.Make();
    p.moveTo(CX, CY);
    p.lineTo(CX + Math.cos(angle - 0.08) * r, CY + Math.sin(angle - 0.08) * r);
    // Arc approximation
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const a = angle - 0.08 + (i / steps) * (Math.PI * 0.18);
      p.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
    }
    p.close();
    return p;
  });

  // Blip opacities — bright when sweep just passed, fade away
  const blipOpacities = useDerivedValue(() => {
    return BLIP_POSITIONS.map(b => {
      const blipAngle = b.angle - Math.PI / 2;
      let diff = ((sweep.value - blipAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (diff > Math.PI * 2) diff = Math.PI * 2;
      // Fade from 1 → 0 over half rotation after sweep passes
      return diff < Math.PI ? Math.max(0, 1 - diff / Math.PI) : 0;
    });
  });

  const blipCount = Math.round((vibeScore.value / 100) * 10 + 2);

  return (
    <View style={styles.wrapper}>
      <Canvas style={{ width: W, height: H }}>
        {/* Dark background */}
        <Circle cx={CX} cy={CY} r={MAX_R + 12} color="#020A06" />

        {/* Grid rings */}
        {RING_RADII.map((r, i) => (
          <Circle key={i} cx={CX} cy={CY} r={r} color={color + '25'} style="stroke" strokeWidth={1} />
        ))}

        {/* Cross-hairs */}
        <Path
          path={(() => { const p = Skia.Path.Make(); p.moveTo(CX, CY - MAX_R); p.lineTo(CX, CY + MAX_R); p.moveTo(CX - MAX_R, CY); p.lineTo(CX + MAX_R, CY); return p; })()}
          color={color + '20'} style="stroke" strokeWidth={1}
        />

        {/* Sweep sector glow */}
        <Path path={sweepPath} color={color + '35'} style="fill">
          <Paint style="fill" color={color + '35'}>
            <BlurMask blur={10} style="solid" />
          </Paint>
        </Path>
        <Path path={sweepPath} color={color + '60'} style="fill" />

        {/* Scout blips */}
        {BLIP_POSITIONS.slice(0, blipCount).map((b, i) => {
          const bx = CX + Math.cos(b.angle - Math.PI / 2) * b.r;
          const by = CY + Math.sin(b.angle - Math.PI / 2) * b.r;
          return (
            <Group key={i} opacity={blipOpacities.value[i] ?? 0}>
              <Circle cx={bx} cy={by} r={4} color={color + 'CC'}>
                <Paint style="fill" color={color + 'CC'}>
                  <BlurMask blur={4} style="solid" />
                </Paint>
              </Circle>
              <Circle cx={bx} cy={by} r={2} color={color} />
            </Group>
          );
        })}

        {/* Center dot */}
        <Circle cx={CX} cy={CY} r={4} color={color} />
        <Circle cx={CX} cy={CY} r={8} color={color + '30'} style="stroke" strokeWidth={1} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ wrapper: { alignItems: 'center' } });
