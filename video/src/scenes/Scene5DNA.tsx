/**
 * Scene 5 — VIBE DNA (75-90s, 450 frames)
 * Left: DNA feature copy. Right: Phone showing DNA card with animating bars.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, font, gradientText } from '../theme';
import { PhoneMockup } from '../components/PhoneMockup';

const DNA_DATA = [
  { type: 'Club', score: 91, count: 89, label: 'Electric', color: C.pink },
  { type: 'Block Party', score: 96, count: 5, label: 'Electric', color: C.orange },
  { type: 'Concert', score: 85, count: 28, label: 'Electric', color: C.gold },
  { type: 'Lounge', score: 68, count: 34, label: 'Popping', color: C.purple },
  { type: 'Bar', score: 55, count: 19, label: 'Chill', color: C.cyan },
  { type: 'Restaurant', score: 47, count: 12, label: 'Chill', color: C.green },
];

function DNABar({ item, frame, delay, maxBarWidth }: { item: typeof DNA_DATA[0]; frame: number; delay: number; maxBarWidth: number }) {
  const barWidth = interpolate(frame, [delay, delay + 60], [0, (item.score / 100) * maxBarWidth], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const rowOp = interpolate(frame, [delay - 10, delay + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ opacity: rowOp, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 64, fontSize: 9, color: C.muted, fontFamily: font, textAlign: 'right', flexShrink: 0 }}>
        {item.type}
      </div>
      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          width: barWidth,
          background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
          borderRadius: 4,
          boxShadow: `0 0 6px ${item.color}40`,
        }} />
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: item.color, fontFamily: font, width: 22, textAlign: 'right', flexShrink: 0 }}>
        {item.score}
      </div>
      <div style={{ fontSize: 8, color: C.muted, fontFamily: font, width: 44, flexShrink: 0 }}>
        {item.label}
      </div>
    </div>
  );
}

export const Scene5DNA: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [400, 450], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const leftY = interpolate(frame, [0, 40], [40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const phoneX = interpolate(frame, [10, 50], [80, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const cardOp = interpolate(frame, [25, 55], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity, flexDirection: 'row', alignItems: 'center', padding: '0 80px', gap: 80 }}>
      {/* ── LEFT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, transform: `translateY(${leftY}px)` }}>
        <div style={{ opacity: interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `${C.purple}15`,
            border: `1px solid ${C.purple}40`,
            borderRadius: 10,
            padding: '6px 14px',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 14 }}>🧬</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.purple, fontFamily: font, letterSpacing: 2 }}>VIBE DNA</span>
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, fontFamily: font, color: C.white }}>
            Your vibe<br />
            <span style={{ ...gradientText(C.purple, C.pink) }}>fingerprint.</span>
          </div>
        </div>

        <div style={{ opacity: interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 20, color: C.muted, fontFamily: font, lineHeight: 1.6, maxWidth: 460 }}>
            Every rating builds a behavioral fingerprint — affinity scores per venue type that power <span style={{ color: C.white }}>personalised recommendations.</span>
          </div>
        </div>

        {/* DNA stats */}
        <div style={{
          display: 'flex',
          gap: 16,
          opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          {[
            { label: 'Dominant scene', value: 'Clubs ⚡' },
            { label: 'Night style', value: '🌙 Night Owl' },
            { label: 'Ratings analysed', value: '187' },
          ].map((s) => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '14px 18px',
              flex: 1,
            }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: font, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: font }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ opacity: interpolate(frame, [100, 130], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 16, color: C.muted, fontFamily: font, lineHeight: 1.6 }}>
            Also powers <span style={{ color: C.pink, fontWeight: 700 }}>VibeMatch</span> — the home screen recommendation card that tells you exactly which venue to go to tonight and why.
          </div>
        </div>
      </div>

      {/* ── RIGHT: Phone ── */}
      <div style={{ transform: `translateX(${phoneX}px)`, opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' }) }}>
        <PhoneMockup scale={1.05} glowColor={C.purple}>
          {/* Profile header */}
          <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
              🔥
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: C.white, fontFamily: font }}>@scout_king</div>
              <div style={{ fontSize: 10, color: C.gold, fontFamily: font }}>⚡ Elite Scout · 2,847 clout</div>
            </div>
          </div>

          {/* DNA Card */}
          <div style={{
            margin: '4px 12px',
            borderRadius: 14,
            background: '#0D0A1A',
            border: `1px solid ${C.purple}40`,
            padding: 14,
            opacity: cardOp,
            boxShadow: `0 0 20px ${C.purple}20`,
          }}>
            {/* Card header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>🧬</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.purple, fontFamily: font, letterSpacing: 1 }}>VIBE DNA</span>
              </div>
              <div style={{
                fontSize: 9,
                color: C.pink,
                background: `${C.pink}15`,
                border: `1px solid ${C.pink}30`,
                borderRadius: 6,
                padding: '2px 6px',
                fontFamily: font,
                fontWeight: 700,
              }}>
                Clubs ⚡ Dominant
              </div>
            </div>

            {/* Night style */}
            <div style={{
              background: `${C.purple}15`,
              border: `1px solid ${C.purple}30`,
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 10,
              color: C.purple,
              fontFamily: font,
              fontWeight: 600,
              marginBottom: 10,
            }}>
              🌙 Night Owl — peaks after midnight
            </div>

            {/* Bars */}
            <div>
              {DNA_DATA.sort((a, b) => b.score - a.score).map((item, i) => (
                <DNABar
                  key={item.type}
                  item={item}
                  frame={frame}
                  delay={50 + i * 25}
                  maxBarWidth={120}
                />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              fontSize: 9,
              color: C.muted,
              fontFamily: font,
              textAlign: 'center',
              marginTop: 6,
              opacity: interpolate(frame, [220, 260], [0, 1], { extrapolateRight: 'clamp' }),
            }}>
              Based on 187 ratings · Updated live
            </div>
          </div>
        </PhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
