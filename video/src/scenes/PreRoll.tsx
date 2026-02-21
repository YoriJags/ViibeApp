/**
 * PreRoll — 0-5s (150 frames)
 * Full black screen. "VIBEZ" logo pulses in. Tagline fades below.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, gradientText, font } from '../theme';

export const PreRoll: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = interpolate(frame, [0, 50], [0.7, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const taglineOpacity = interpolate(frame, [50, 90], [0, 1], { extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [50, 90], [20, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // Glow pulse
  const glowIntensity = interpolate(
    frame % 60,
    [0, 30, 60],
    [30, 60, 30],
    { extrapolateRight: 'clamp' }
  );
  // Fade out at end
  const fadeOut = interpolate(frame, [120, 150], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        opacity: fadeOut,
      }}
    >
      {/* Radial glow behind logo */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${C.pink}15 0%, transparent 70%)`,
          opacity: logoOpacity,
        }}
      />

      {/* VIBEZ wordmark */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          fontFamily: font,
          fontSize: 120,
          fontWeight: 900,
          letterSpacing: -4,
          ...gradientText(C.pink, C.purple),
          textShadow: undefined,
          filter: `drop-shadow(0 0 ${glowIntensity}px ${C.pink}80)`,
          lineHeight: 1,
        }}
      >
        VIBEZ
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: font,
          fontSize: 28,
          fontWeight: 400,
          color: C.muted,
          letterSpacing: 6,
          textTransform: 'uppercase',
        }}
      >
        Where's the energy?
      </div>
    </AbsoluteFill>
  );
};
