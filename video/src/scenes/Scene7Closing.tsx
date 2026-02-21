/**
 * Scene 7 — CLOSING / CTA (105-120s, 450 frames)
 * Full-screen. Feature checkmarks reveal. Investment card. Final logo.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, font, gradientText } from '../theme';

const FEATURES = [
  { icon: '📡', text: 'Live vibe scores — updated every few minutes from on-ground scouts', color: C.pink },
  { icon: '🔮', text: 'Vibe Oracle — peak-time prediction with 87% confidence', color: C.gold },
  { icon: '🧬', text: 'Vibe DNA — behavioral fingerprint powering personalised picks', color: C.purple },
  { icon: '✨', text: 'Ask Vibe — AI concierge (Claude API path ready to activate)', color: C.cyan },
  { icon: '📊', text: 'Merchant intelligence — live analytics + campaign ROI tools', color: C.green },
  { icon: '⚡', text: 'City Pulse — real-time city heartbeat, 247 scouts active tonight', color: C.orange },
];

function CheckItem({ item, frame, delay }: { item: typeof FEATURES[0]; frame: number; delay: number }) {
  const progress = interpolate(frame, [delay, delay + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{
      opacity: progress,
      transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 12,
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: `${item.color}15`,
        border: `1px solid ${item.color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}>
        {item.icon}
      </div>
      <div style={{ fontSize: 18, color: C.white, fontFamily: font, lineHeight: 1.4 }}>
        {item.text}
      </div>
    </div>
  );
}

export const Scene7Closing: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  // Final logo pulse
  const logoPulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
  const logoOpacity = interpolate(frame, [300, 340], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = interpolate(frame, [300, 360], [0.7, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const investOpacity = interpolate(frame, [260, 300], [0, 1], { extrapolateRight: 'clamp' });
  const investY = interpolate(frame, [260, 300], [30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const headerOpacity = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp' });
  const headerY = interpolate(frame, [0, 35], [-30, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Glow behind everything
  const glowRadius = interpolate(frame, [0, 200], [300, 700], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: fadeIn, alignItems: 'center', justifyContent: 'center', padding: '0 100px' }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: glowRadius,
        height: glowRadius,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${C.pink}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 80, width: '100%', alignItems: 'flex-start', maxWidth: 1600 }}>
        {/* LEFT: Features */}
        <div style={{ flex: 1 }}>
          <div style={{
            opacity: headerOpacity,
            transform: `translateY(${headerY}px)`,
            marginBottom: 36,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.muted, fontFamily: font, letterSpacing: 3, marginBottom: 10 }}>
              WHAT WE'VE BUILT
            </div>
            <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, fontFamily: font }}>
              <span style={{ color: C.white }}>Not a review app.<br /></span>
              <span style={{ ...gradientText(C.pink, C.purple) }}>The intelligence layer.</span>
            </div>
          </div>

          {FEATURES.map((f, i) => (
            <CheckItem key={f.text} item={f} frame={frame} delay={40 + i * 30} />
          ))}
        </div>

        {/* RIGHT: Final card + Logo */}
        <div style={{ width: 440, display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 60 }}>
          {/* Investment card */}
          <div style={{
            opacity: investOpacity,
            transform: `translateY(${investY}px)`,
            background: `linear-gradient(135deg, rgba(255,51,102,0.08), rgba(153,51,255,0.08))`,
            border: `1px solid ${C.pink}30`,
            borderRadius: 20,
            padding: 28,
            boxShadow: `0 0 40px ${C.pink}15`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: font, letterSpacing: 2, marginBottom: 16 }}>
              PRE-SEED ROUND
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, fontFamily: font, ...gradientText(C.pink, C.purple), marginBottom: 4 }}>
              $150–300K
            </div>
            <div style={{ fontSize: 15, color: C.muted, fontFamily: font, marginBottom: 24 }}>
              Lagos, Nigeria · 2026
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Use of funds', value: 'Team · Infrastructure · Growth' },
                { label: 'Revenue target', value: '₦15M–₦50M ARR (Month 24)' },
                { label: 'Exit target', value: '$250M+ (Month 60)' },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 12, color: C.muted, fontFamily: font }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: font }}>{r.value}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: C.pink, fontFamily: font, textAlign: 'center' }}>
              yoriajagun08@gmail.com
            </div>
          </div>

          {/* Final VIBEZ logo */}
          <div style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            textAlign: 'center',
            filter: `drop-shadow(0 0 ${logoPulse * 40}px ${C.pink}60)`,
          }}>
            <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -3, fontFamily: font, ...gradientText(C.pink, C.purple), lineHeight: 1 }}>
              VIBEZ
            </div>
            <div style={{ fontSize: 14, color: C.muted, fontFamily: font, letterSpacing: 5, marginTop: 6, textTransform: 'uppercase' }}>
              Where's the energy?
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
