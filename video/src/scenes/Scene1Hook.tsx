/**
 * Scene 1 — THE HOOK (5-20s, 450 frames)
 * Left: Big city name + "Right now." copy. Right: Phone showing live venue list.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, font, gradientText } from '../theme';
import { PhoneMockup } from '../components/PhoneMockup';

const VENUES = [
  { name: 'Quilox', area: 'Victoria Island', type: 'Club', score: 91, energy: 'ELECTRIC', color: C.pink },
  { name: 'Escape', area: 'Victoria Island', type: 'Club', score: 87, energy: 'ELECTRIC', color: C.purple },
  { name: 'Shiro', area: 'Victoria Island', type: 'Lounge', score: 74, energy: 'POPPING', color: C.cyan },
  { name: 'The Place', area: 'Lekki', type: 'Restaurant', score: 68, energy: 'BUZZING', color: C.gold },
];

function VenueCardMini({
  venue,
  frame,
  delay,
}: {
  venue: typeof VENUES[0];
  frame: number;
  delay: number;
}) {
  const progress = interpolate(frame, [delay, delay + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const score = Math.floor(interpolate(frame, [delay + 10, delay + 50], [0, venue.score], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));
  // Pulsing border glow
  const pulse = Math.sin((frame - delay) * 0.15) * 0.5 + 0.5;

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [30, 0])}px)`,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        border: `1px solid rgba(255,255,255,0.07)`,
        boxShadow: `0 0 ${8 + pulse * 12}px ${venue.color}30`,
        padding: '10px 12px',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Score bubble */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: `${venue.color}22`,
          border: `1.5px solid ${venue.color}60`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 900, color: venue.color, fontFamily: font }}>
          {score}
        </span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.white, fontFamily: font, letterSpacing: -0.3 }}>
          {venue.name}
        </div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: font }}>
          {venue.area} · {venue.type}
        </div>
      </div>

      {/* Energy chip */}
      <div
        style={{
          background: `${venue.color}20`,
          border: `1px solid ${venue.color}40`,
          borderRadius: 6,
          padding: '3px 7px',
          fontSize: 9,
          fontWeight: 800,
          color: venue.color,
          fontFamily: font,
          letterSpacing: 0.8,
        }}
      >
        {venue.energy}
      </div>
    </div>
  );
}

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [400, 450], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerY = interpolate(frame, [0, 35], [-30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const line1Y = interpolate(frame, [10, 45], [30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const line2Y = interpolate(frame, [20, 55], [30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const line3Y = interpolate(frame, [35, 70], [30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const statsY = interpolate(frame, [50, 85], [30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const phoneX = interpolate(frame, [15, 55], [80, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Live dot blink
  const dotOpacity = Math.round(Math.sin(frame * 0.2) * 0.5 + 0.5);

  return (
    <AbsoluteFill style={{ opacity, flexDirection: 'row', alignItems: 'center', padding: '0 80px', gap: 80 }}>
      {/* ── LEFT: Copy ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Overline */}
        <div
          style={{
            opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${headerY}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.pink, opacity: dotOpacity }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.pink, fontFamily: font, letterSpacing: 3, textTransform: 'uppercase' }}>
            Live · Lagos
          </span>
        </div>

        {/* Hero text */}
        <div style={{ transform: `translateY(${line1Y}px)`, opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 90, fontWeight: 900, letterSpacing: -3, lineHeight: 0.95, fontFamily: font, color: C.white }}>
            Real-time
          </div>
        </div>
        <div style={{ transform: `translateY(${line2Y}px)`, opacity: interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 90, fontWeight: 900, letterSpacing: -3, lineHeight: 0.95, fontFamily: font, ...gradientText(C.pink, C.purple) }}>
            venue intel.
          </div>
        </div>

        <div
          style={{
            height: 2,
            width: interpolate(frame, [40, 80], [0, 320], { extrapolateRight: 'clamp' }),
            background: `linear-gradient(90deg, ${C.pink}, ${C.purple})`,
            borderRadius: 2,
            margin: '20px 0',
          }}
        />

        {/* Sub copy */}
        <div style={{ transform: `translateY(${line3Y}px)`, opacity: interpolate(frame, [35, 65], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 22, fontWeight: 400, color: C.muted, fontFamily: font, lineHeight: 1.5, maxWidth: 480 }}>
            Not last week's reviews.<br />Not historical averages.<br />
            <span style={{ color: C.white, fontWeight: 700 }}>Right now, from scouts on the ground.</span>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 40,
            transform: `translateY(${statsY}px)`,
            opacity: interpolate(frame, [50, 80], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {[
            { value: '247', label: 'Scouts Active' },
            { value: '34', label: 'Venues Live' },
            { value: '1,143', label: 'Pulses Tonight' },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.white, fontFamily: font, letterSpacing: -1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: font, letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Phone ── */}
      <div style={{ transform: `translateX(${phoneX}px)`, opacity: interpolate(frame, [15, 45], [0, 1], { extrapolateRight: 'clamp' }) }}>
        <PhoneMockup scale={1.05} glowColor={C.pink}>
          {/* App header */}
          <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.white, fontFamily: font, letterSpacing: -1 }}>VIBEZ</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: font }}>🏙️ Lagos Nightlife</div>
            </div>
            <div style={{
              background: 'rgba(255,51,102,0.15)',
              border: `1px solid ${C.pink}40`,
              borderRadius: 8,
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.pink, opacity: dotOpacity }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: C.pink, fontFamily: font, letterSpacing: 1 }}>LIVE</span>
            </div>
          </div>

          {/* Venue list */}
          <div style={{ padding: '4px 12px', flex: 1 }}>
            {VENUES.map((v, i) => (
              <VenueCardMini key={v.name} venue={v} frame={frame} delay={30 + i * 20} />
            ))}
          </div>
        </PhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
