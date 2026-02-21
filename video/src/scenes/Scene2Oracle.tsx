/**
 * Scene 2 — VIBE ORACLE (20-38s, 540 frames)
 * Left: Oracle feature intro copy. Right: Phone showing Oracle prediction card.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, font, gradientText } from '../theme';
import { PhoneMockup } from '../components/PhoneMockup';

const SIGNALS = [
  { icon: '🌙', label: 'Friday Night', color: C.purple },
  { icon: '📈', label: 'Heating Up', color: C.orange },
  { icon: '🎵', label: 'Afrobeats', color: C.cyan },
];

function ConfidenceBadge({ confidence, frame }: { confidence: number; frame: number }) {
  const value = Math.floor(interpolate(frame, [20, 80], [0, confidence], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <div style={{
      background: `${C.green}20`,
      border: `1px solid ${C.green}50`,
      borderRadius: 8,
      padding: '4px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
      <span style={{ fontSize: 12, fontWeight: 800, color: C.green, fontFamily: font }}>{value}% confidence</span>
    </div>
  );
}

export const Scene2Oracle: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [490, 540], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const leftY = interpolate(frame, [0, 40], [40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const phoneX = interpolate(frame, [10, 50], [80, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Oracle card animates in on phone
  const cardScale = interpolate(frame, [30, 70], [0.85, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const cardOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' });
  const headlineOpacity = interpolate(frame, [60, 100], [0, 1], { extrapolateRight: 'clamp' });
  const arrivalOpacity = interpolate(frame, [90, 130], [0, 1], { extrapolateRight: 'clamp' });

  // Glow pulse on oracle card
  const oracleGlow = Math.sin(frame * 0.12) * 0.4 + 0.6;

  return (
    <AbsoluteFill style={{ opacity, flexDirection: 'row', alignItems: 'center', padding: '0 80px', gap: 80 }}>
      {/* ── LEFT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, transform: `translateY(${leftY}px)` }}>
        {/* Feature label */}
        <div style={{ opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `${C.gold}15`,
            border: `1px solid ${C.gold}40`,
            borderRadius: 10,
            padding: '6px 14px',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 16 }}>🔮</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, fontFamily: font, letterSpacing: 2 }}>VIBE ORACLE</span>
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, fontFamily: font, color: C.white }}>
            Know before<br />
            <span style={{ ...gradientText(C.gold, C.orange) }}>you go.</span>
          </div>
        </div>

        <div style={{ opacity: interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' }), display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 20, color: C.muted, fontFamily: font, lineHeight: 1.6, maxWidth: 460 }}>
            Peak-time prediction for every venue —<br />
            <span style={{ color: C.white }}>when to arrive, what energy to expect,<br />how confident we are.</span>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: 16,
            marginTop: 8,
          }}>
            {[
              { label: 'Predictive accuracy', value: '87%' },
              { label: 'Venues covered', value: '34' },
              { label: 'Signals tracked', value: '12+' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '12px 16px',
              }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.gold, fontFamily: font }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: font }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Phone ── */}
      <div style={{
        transform: `translateX(${phoneX}px)`,
        opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        <PhoneMockup scale={1.05} glowColor={C.gold}>
          {/* Venue header on phone */}
          <div style={{ padding: '10px 14px 6px' }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: font }}>← Back</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.white, fontFamily: font, letterSpacing: -0.5 }}>Quilox</div>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: font }}>Victoria Island · Club · ⚡ Electric</div>
          </div>

          {/* Oracle card */}
          <div style={{
            margin: '8px 12px',
            borderRadius: 14,
            background: `linear-gradient(135deg, ${C.bgCard}, #1A0A00)`,
            border: `1px solid ${C.gold}${Math.round(oracleGlow * 60 + 40).toString(16)}`,
            boxShadow: `0 0 ${oracleGlow * 20}px ${C.gold}25`,
            padding: 14,
            opacity: cardOpacity,
            transform: `scale(${cardScale})`,
          }}>
            {/* Oracle header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>🔮</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.gold, fontFamily: font, letterSpacing: 1.5 }}>VIBE ORACLE</span>
              </div>
              <ConfidenceBadge confidence={87} frame={frame} />
            </div>

            {/* Headline */}
            <div style={{ opacity: headlineOpacity }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.white, fontFamily: font, lineHeight: 1.4, marginBottom: 6 }}>
                Quilox will be{' '}
                <span style={{ color: C.pink }}>electric</span>
                {' '}by 12:30am tonight
              </div>
            </div>

            {/* Arrival */}
            <div style={{ opacity: arrivalOpacity, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: font }}>
                Best time to arrive:{' '}
                <span style={{ color: C.gold, fontWeight: 700 }}>11:45pm</span>
              </div>
            </div>

            {/* Signal chips */}
            <div style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              opacity: interpolate(frame, [130, 160], [0, 1], { extrapolateRight: 'clamp' }),
            }}>
              {SIGNALS.map((sig, i) => (
                <div key={sig.label} style={{
                  opacity: interpolate(frame, [130 + i * 20, 160 + i * 20], [0, 1], { extrapolateRight: 'clamp' }),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: `${sig.color}15`,
                  border: `1px solid ${sig.color}35`,
                  borderRadius: 20,
                  padding: '3px 8px',
                }}>
                  <span style={{ fontSize: 10 }}>{sig.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sig.color, fontFamily: font }}>{sig.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Forecast mini preview below */}
          <div style={{
            margin: '4px 12px',
            padding: 12,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.border}`,
            opacity: interpolate(frame, [180, 220], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: font, marginBottom: 8, letterSpacing: 1 }}>
              VIBE FORECAST — Weekly Pattern
            </div>
            {/* Simple bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
              {[30, 45, 55, 70, 88, 91, 75].map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%',
                    height: interpolate(
                      frame,
                      [200 + i * 10, 250 + i * 10],
                      [0, (h / 100) * 36],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                    ),
                    background: i === 5
                      ? `linear-gradient(180deg, ${C.pink}, ${C.purple})`
                      : `rgba(255,255,255,0.15)`,
                    borderRadius: 3,
                  }} />
                  <div style={{ fontSize: 7, color: C.muted, fontFamily: font }}>
                    {['M','T','W','T','F','S','S'][i]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
