/**
 * Scene 6 — MERCHANT INTELLIGENCE (90-105s, 450 frames)
 * Left: Merchant revenue pitch. Right: Phone showing live analytics dashboard.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, font, gradientText } from '../theme';
import { PhoneMockup } from '../components/PhoneMockup';

const HOURLY = [20, 28, 40, 52, 68, 82, 91, 87, 74, 55];
const HOURS = ['8PM','9PM','10PM','11PM','12AM','1AM','2AM','3AM','4AM','5AM'];

export const Scene6Merchant: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [400, 450], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const leftY = interpolate(frame, [0, 40], [40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const phoneX = interpolate(frame, [10, 50], [80, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Animated revenue counter
  const revenue = Math.floor(interpolate(frame, [60, 150], [0, 127450], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }));
  const revenueFormatted = `₦${(revenue / 1000).toFixed(0)}K`;

  // Chart bars animate
  const chartProgress = interpolate(frame, [40, 130], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ opacity, flexDirection: 'row', alignItems: 'center', padding: '0 80px', gap: 80 }}>
      {/* ── LEFT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, transform: `translateY(${leftY}px)` }}>
        <div style={{ opacity: interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `${C.green}15`,
            border: `1px solid ${C.green}40`,
            borderRadius: 10,
            padding: '6px 14px',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 14 }}>📊</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.green, fontFamily: font, letterSpacing: 2 }}>MERCHANT FLOOR</span>
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, fontFamily: font, color: C.white }}>
            Venues pay<br />
            <span style={{ ...gradientText(C.green, C.cyan) }}>to own the data.</span>
          </div>
        </div>

        <div style={{ opacity: interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 20, color: C.muted, fontFamily: font, lineHeight: 1.6, maxWidth: 480 }}>
            Live analytics dashboard for every verified venue — vibe score, peak hours, crowd flow, campaign ROI.
          </div>
        </div>

        {/* Revenue model */}
        <div style={{
          display: 'flex',
          gap: 16,
          opacity: interpolate(frame, [50, 80], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          {[
            { label: 'Monthly subscription', value: '₦50K–₦200K', color: C.green },
            { label: 'Campaign boost (CPM)', value: '₦5K–₦20K', color: C.cyan },
            { label: 'Pulse Drop ads', value: '₦15K–₦60K', color: C.gold },
          ].map((s) => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              flex: 1,
            }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: s.color, fontFamily: font, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: font }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Target */}
        <div style={{
          opacity: interpolate(frame, [100, 130], [0, 1], { extrapolateRight: 'clamp' }),
          background: `${C.green}10`,
          border: `1px solid ${C.green}30`,
          borderRadius: 14,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 28 }}>🎯</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: font }}>₦15M–₦50M ARR by Month 24</div>
            <div style={{ fontSize: 13, color: C.muted, fontFamily: font }}>50 venues × ₦100K avg subscription + campaign revenue</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Phone ── */}
      <div style={{ transform: `translateX(${phoneX}px)`, opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' }) }}>
        <PhoneMockup scale={1.05} glowColor={C.green}>
          {/* Merchant header */}
          <div style={{ padding: '10px 14px 8px' }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: font, marginBottom: 2 }}>📊 VENUE ANALYTICS</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: font, letterSpacing: -0.5 }}>Quilox</div>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '0 12px',
            marginBottom: 10,
          }}>
            {[
              { label: 'Vibe Score', value: '91', color: C.pink },
              { label: 'Energy', value: '⚡ ELECTRIC', color: C.orange },
              { label: 'Peak', value: '1:00am', color: C.gold },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: s.color, fontFamily: font }}>{s.value}</div>
                <div style={{ fontSize: 8, color: C.muted, fontFamily: font }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Hourly chart */}
          <div style={{ padding: '0 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, fontFamily: font, marginBottom: 6, letterSpacing: 1 }}>
              HOURLY ENERGY CURVE
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, marginBottom: 4 }}>
              {HOURLY.map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%',
                    height: (h / 100) * 52 * chartProgress,
                    background: i === 6
                      ? `linear-gradient(180deg, ${C.pink}, ${C.purple})`
                      : i >= 4 && i <= 7
                      ? `linear-gradient(180deg, ${C.orange}cc, ${C.orange}66)`
                      : 'rgba(255,255,255,0.12)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.3s',
                  }} />
                  <div style={{ fontSize: 6, color: C.muted, fontFamily: font, transform: 'rotate(-45deg)', transformOrigin: 'top center', marginTop: 2 }}>
                    {HOURS[i]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue card */}
          <div style={{
            margin: '0 12px',
            background: `${C.green}12`,
            border: `1px solid ${C.green}30`,
            borderRadius: 12,
            padding: '10px 12px',
            opacity: interpolate(frame, [80, 110], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: font, marginBottom: 3 }}>REVENUE THIS WEEK</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.green, fontFamily: font, letterSpacing: -0.5 }}>{revenueFormatted}</div>
            <div style={{ fontSize: 10, color: C.green, fontFamily: font }}>↑ +34% vs last week</div>
          </div>

          {/* Campaign banner */}
          <div style={{
            margin: '8px 12px',
            background: `linear-gradient(135deg, ${C.pink}20, ${C.purple}20)`,
            border: `1px solid ${C.pink}30`,
            borderRadius: 10,
            padding: '8px 10px',
            opacity: interpolate(frame, [140, 170], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.pink, fontFamily: font, letterSpacing: 1 }}>🎯 ACTIVE CAMPAIGN</div>
            <div style={{ fontSize: 10, color: C.white, fontFamily: font, marginTop: 2 }}>Friday Night Boost · 3× clout multiplier</div>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: font }}>47 scouts targeted · 89% in geofence</div>
          </div>
        </PhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
