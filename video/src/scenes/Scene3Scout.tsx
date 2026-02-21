/**
 * Scene 3 — SCOUT THE VIBE (38-52s, 420 frames)
 * Left: "The data engine" copy. Right: Phone showing the rating modal with emoji cards.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, font, gradientText } from '../theme';
import { PhoneMockup } from '../components/PhoneMockup';

const ENERGY_OPTIONS = [
  { emoji: '😌', label: 'CHILL', color: C.cyan },
  { emoji: '😏', label: 'BUZZING', color: '#AAB4FF' },
  { emoji: '🤩', label: 'POPPING', color: C.orange },
  { emoji: '😵', label: 'ELECTRIC', color: C.pink, selected: true },
];

const CAPACITY_OPTIONS = [
  { emoji: '😶', label: 'SPARSE', color: C.muted },
  { emoji: '😁', label: 'VIBRANT', color: C.gold, selected: true },
  { emoji: '🥵', label: 'PACKED', color: C.pink },
];

const GATE_OPTIONS = [
  { emoji: '✅', label: 'FREE IN', color: C.green, selected: true },
  { emoji: '⏳', label: 'QUEUING', color: C.gold },
  { emoji: '🚫', label: 'LOCKED', color: '#FF4444' },
];

function EmojiCard({ emoji, label, color, selected, scale }: { emoji: string; label: string; color: string; selected?: boolean; scale: number }) {
  return (
    <div style={{
      flex: 1,
      background: selected ? `${color}20` : 'rgba(255,255,255,0.03)',
      border: `1.5px solid ${selected ? color : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 4px',
      gap: 4,
      boxShadow: selected ? `0 0 12px ${color}30` : 'none',
    }}>
      <span style={{ fontSize: 20 * scale }}>{emoji}</span>
      <span style={{ fontSize: 8 * scale, fontWeight: 800, color: selected ? color : C.muted, fontFamily: font, letterSpacing: 0.8 }}>{label}</span>
    </div>
  );
}

export const Scene3Scout: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [370, 420], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const leftY = interpolate(frame, [0, 40], [40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const phoneX = interpolate(frame, [10, 50], [80, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Modal slides up on the phone
  const modalY = interpolate(frame, [20, 60], [300, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const section1Op = interpolate(frame, [50, 90], [0, 1], { extrapolateRight: 'clamp' });
  const section2Op = interpolate(frame, [90, 130], [0, 1], { extrapolateRight: 'clamp' });
  const section3Op = interpolate(frame, [130, 170], [0, 1], { extrapolateRight: 'clamp' });
  const btnOp = interpolate(frame, [200, 240], [0, 1], { extrapolateRight: 'clamp' });

  // Clout toast
  const toastOp = interpolate(frame, [260, 290], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const toastY = interpolate(frame, [260, 290], [20, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const toastFade = interpolate(frame, [330, 370], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const toastOpFinal = Math.min(toastOp, toastFade);

  const SCALE = 1.05;

  return (
    <AbsoluteFill style={{ opacity, flexDirection: 'row', alignItems: 'center', padding: '0 80px', gap: 80 }}>
      {/* ── LEFT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, transform: `translateY(${leftY}px)` }}>
        <div style={{ opacity: interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `${C.pink}15`,
            border: `1px solid ${C.pink}40`,
            borderRadius: 10,
            padding: '6px 14px',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 14 }}>⚡</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.pink, fontFamily: font, letterSpacing: 2 }}>THE DATA ENGINE</span>
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, fontFamily: font, color: C.white }}>
            3 taps.<br />
            <span style={{ ...gradientText(C.pink, C.purple) }}>City updated.</span>
          </div>
        </div>

        <div style={{ opacity: interpolate(frame, [35, 65], [0, 1], { extrapolateRight: 'clamp' }), display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 20, color: C.muted, fontFamily: font, lineHeight: 1.6, maxWidth: 460 }}>
            Every scout rates in 3 dimensions:<br />
            <span style={{ color: C.white, fontWeight: 700 }}>Energy · Capacity · Gate.</span>
            <br />Each rating updates the live vibe score instantly.
          </div>

          {/* Dimension pills */}
          {[
            { emoji: '⚡', label: 'ENERGY', desc: 'Chill → Electric', color: C.pink },
            { emoji: '👥', label: 'CAPACITY', desc: 'Sparse → Packed', color: C.cyan },
            { emoji: '🚪', label: 'GATE', desc: 'Free In → Locked', color: C.gold },
            { emoji: '🎛️', label: 'DJ / SCENE', desc: 'Venue-specific 4th dimension', color: C.purple },
          ].map((d, i) => (
            <div key={d.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: interpolate(frame, [50 + i * 20, 80 + i * 20], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateX(${interpolate(frame, [50 + i * 20, 80 + i * 20], [-20, 0], { extrapolateRight: 'clamp' })}px)`,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${d.color}15`,
                border: `1px solid ${d.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}>
                {d.emoji}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: d.color, fontFamily: font, letterSpacing: 1 }}>{d.label}</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: font }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Phone ── */}
      <div style={{ transform: `translateX(${phoneX}px)`, opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' }), position: 'relative' }}>
        <PhoneMockup scale={SCALE} glowColor={C.pink}>
          {/* Background venue (dimmed) */}
          <div style={{ padding: '10px 14px 6px' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.3)', fontFamily: font }}>Quilox</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: font }}>Victoria Island · Club</div>
          </div>

          {/* Modal overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <div style={{
              background: '#0D0D1A',
              borderRadius: '18px 18px 0 0',
              border: `1px solid ${C.border}`,
              padding: 16,
              transform: `translateY(${modalY}px)`,
              borderTopColor: 'rgba(255,255,255,0.1)',
            }}>
              {/* Handle */}
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 12px' }} />

              <div style={{ fontSize: 14, fontWeight: 900, color: C.white, fontFamily: font, marginBottom: 4 }}>Rate the Vibe</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: font, marginBottom: 12 }}>Quilox · Victoria Island</div>

              {/* Energy 2x2 */}
              <div style={{ opacity: section1Op }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, fontFamily: font, letterSpacing: 1.5, marginBottom: 6 }}>ENERGY</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {ENERGY_OPTIONS.map((opt) => (
                    <EmojiCard key={opt.label} {...opt} scale={SCALE} />
                  ))}
                </div>
              </div>

              {/* Capacity row */}
              <div style={{ opacity: section2Op }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, fontFamily: font, letterSpacing: 1.5, marginBottom: 6 }}>CAPACITY</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {CAPACITY_OPTIONS.map((opt) => (
                    <EmojiCard key={opt.label} {...opt} scale={SCALE} />
                  ))}
                </div>
              </div>

              {/* Gate row */}
              <div style={{ opacity: section3Op }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, fontFamily: font, letterSpacing: 1.5, marginBottom: 6 }}>GATE</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {GATE_OPTIONS.map((opt) => (
                    <EmojiCard key={opt.label} {...opt} scale={SCALE} />
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <div style={{
                opacity: btnOp,
                background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`,
                borderRadius: 12,
                padding: '12px',
                textAlign: 'center',
                color: C.white,
                fontWeight: 900,
                fontSize: 13,
                fontFamily: font,
                letterSpacing: 0.5,
                boxShadow: `0 4px 20px ${C.pink}40`,
              }}>
                Drop the Vibe ✦
              </div>
            </div>
          </div>
        </PhoneMockup>

        {/* Clout toast */}
        <div style={{
          position: 'absolute',
          top: 60,
          left: '50%',
          transform: `translateX(-50%) translateY(${toastY}px)`,
          opacity: toastOpFinal,
          background: `linear-gradient(135deg, ${C.gold}22, ${C.orange}22)`,
          border: `1px solid ${C.gold}60`,
          borderRadius: 20,
          padding: '8px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          boxShadow: `0 4px 24px ${C.gold}30`,
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: C.gold, fontFamily: font }}>+15 CLOUT</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
