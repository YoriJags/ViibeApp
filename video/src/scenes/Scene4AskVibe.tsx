/**
 * Scene 4 — ASK VIBE (52-75s, 690 frames)
 * Left: AI concierge pitch copy. Right: Phone showing Ask Vibe chat modal.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { C, font, gradientText } from '../theme';
import { PhoneMockup } from '../components/PhoneMockup';

const USER_MSG = 'Afrobeats, Lekki, squad of 6?';
const VENUES_REPLY = [
  { name: 'Escape Nightclub', area: 'Victoria Island', score: 88, energy: 'ELECTRIC', entry: '₦5,000', match: 94 },
  { name: 'House 70', area: 'Lekki Phase 1', score: 76, energy: 'POPPING', entry: 'Free before 11pm', match: 89 },
];

function TypingDot({ frame, delay }: { frame: number; delay: number }) {
  const y = Math.sin((frame - delay) * 0.4) * 3;
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%',
      background: C.muted,
      transform: `translateY(${y}px)`,
    }} />
  );
}

export const Scene4AskVibe: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [640, 690], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const leftY = interpolate(frame, [0, 40], [40, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const phoneX = interpolate(frame, [10, 50], [80, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Chat sequence
  const modalOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' });
  const userMsgOp = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' });

  // Typewriter
  const charsVisible = Math.floor(interpolate(frame, [70, 160], [0, USER_MSG.length], { extrapolateRight: 'clamp' }));

  const typingOp = interpolate(frame, [165, 185], [0, 1], { extrapolateRight: 'clamp' });
  const typingFade = interpolate(frame, [240, 265], [1, 0], { extrapolateRight: 'clamp' });
  const typingFinal = Math.min(typingOp, typingFade);

  const replyOp = interpolate(frame, [265, 295], [0, 1], { extrapolateRight: 'clamp' });
  const replyY = interpolate(frame, [265, 295], [20, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const card1Op = interpolate(frame, [310, 340], [0, 1], { extrapolateRight: 'clamp' });
  const card2Op = interpolate(frame, [360, 390], [0, 1], { extrapolateRight: 'clamp' });

  const tagOp = interpolate(frame, [450, 490], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity, flexDirection: 'row', alignItems: 'center', padding: '0 80px', gap: 80 }}>
      {/* ── LEFT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, transform: `translateY(${leftY}px)` }}>
        <div style={{ opacity: interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp' }) }}>
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
            <span style={{ fontSize: 14 }}>✨</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, fontFamily: font, letterSpacing: 2 }}>ASK VIBE</span>
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, fontFamily: font, color: C.white }}>
            Your AI<br />
            <span style={{ ...gradientText(C.gold, C.orange) }}>scene guide.</span>
          </div>
        </div>

        <div style={{ opacity: interpolate(frame, [30, 60], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 20, color: C.muted, fontFamily: font, lineHeight: 1.6, maxWidth: 460 }}>
            Ask it anything. It reads the live vibe of every venue in the city — clubs, restaurants, concerts, brunch spots.
          </div>
        </div>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: '📍', text: 'Area, budget, crew size — all factors', delay: 60 },
            { icon: '📡', text: 'Answers grounded in live vibe data', delay: 80 },
            { icon: '🤖', text: 'Rule-based today. Claude AI when key is set.', delay: 100 },
          ].map((b) => (
            <div key={b.text} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: interpolate(frame, [b.delay, b.delay + 30], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `translateX(${interpolate(frame, [b.delay, b.delay + 30], [-20, 0], { extrapolateRight: 'clamp' })}px)`,
            }}>
              <span style={{ fontSize: 20 }}>{b.icon}</span>
              <span style={{ fontSize: 16, color: C.muted, fontFamily: font }}>{b.text}</span>
            </div>
          ))}
        </div>

        {/* Claude API tag */}
        <div style={{
          opacity: tagOp,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(153,51,255,0.12)',
          border: `1px solid ${C.purple}40`,
          borderRadius: 12,
          padding: '10px 18px',
          maxWidth: 380,
        }}>
          <span style={{ fontSize: 18 }}>🔑</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.purple, fontFamily: font }}>Claude API path is live</div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: font }}>Set ANTHROPIC_API_KEY → instant upgrade. Zero code change.</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Phone ── */}
      <div style={{ transform: `translateX(${phoneX}px)`, opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' }) }}>
        <PhoneMockup scale={1.05} glowColor={C.gold}>
          {/* Ask Vibe Modal */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', opacity: modalOpacity }}>
            {/* Header */}
            <div style={{
              padding: '12px 14px 10px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>✨</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: C.white, fontFamily: font, letterSpacing: -0.5 }}>ASK VIBE</span>
              </div>
              <span style={{ fontSize: 18, color: C.muted }}>✕</span>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'hidden' }}>
              {/* Suggestion chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {['Clubs in VI tonight', 'Afrobeats squad', 'Good brunch spots'].map((s, i) => (
                  <div key={s} style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${C.border}`,
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 9,
                    color: C.muted,
                    fontFamily: font,
                    opacity: interpolate(frame, [30 + i * 10, 60 + i * 10], [0, 1], { extrapolateRight: 'clamp' }),
                  }}>
                    {s}
                  </div>
                ))}
              </div>

              {/* User message */}
              <div style={{ opacity: userMsgOp, alignSelf: 'flex-end', maxWidth: '80%' }}>
                <div style={{
                  background: `linear-gradient(135deg, ${C.pink}90, ${C.purple}90)`,
                  borderRadius: '12px 12px 3px 12px',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: C.white,
                  fontFamily: font,
                  fontWeight: 500,
                }}>
                  {USER_MSG.slice(0, charsVisible)}
                  {charsVisible < USER_MSG.length && (
                    <span style={{ opacity: Math.sin(frame * 0.5) * 0.5 + 0.5 }}>|</span>
                  )}
                </div>
              </div>

              {/* Typing indicator */}
              <div style={{ opacity: typingFinal, alignSelf: 'flex-start' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${C.border}`,
                  borderRadius: '12px 12px 12px 3px',
                  padding: '10px 14px',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                }}>
                  {[0, 1, 2].map((i) => <TypingDot key={i} frame={frame} delay={i * 8} />)}
                </div>
              </div>

              {/* AI reply */}
              <div style={{
                opacity: replyOp,
                transform: `translateY(${replyY}px)`,
                alignSelf: 'flex-start',
                maxWidth: '90%',
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${C.border}`,
                  borderRadius: '12px 12px 12px 3px',
                  padding: '8px 10px',
                  fontSize: 11,
                  color: C.white,
                  fontFamily: font,
                  lineHeight: 1.5,
                  marginBottom: 8,
                }}>
                  Found 2 perfect Afrobeats spots in Lekki right now 🔥
                </div>

                {/* Venue cards */}
                {VENUES_REPLY.map((v, i) => (
                  <div key={v.name} style={{
                    opacity: i === 0 ? card1Op : card2Op,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: '8px 10px',
                    marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.white, fontFamily: font }}>{v.name}</span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 900,
                        color: C.green,
                        background: `${C.green}15`,
                        border: `1px solid ${C.green}30`,
                        borderRadius: 6,
                        padding: '2px 5px',
                        fontFamily: font,
                      }}>
                        {v.match}% match
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: font, marginBottom: 2 }}>
                      {v.area} · {v.entry}
                    </div>
                    <div style={{ fontSize: 9, color: C.pink, fontFamily: font }}>Vibe {v.score} · {v.energy}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input bar */}
            <div style={{
              padding: '8px 12px',
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <div style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                padding: '7px 12px',
                fontSize: 10,
                color: C.muted,
                fontFamily: font,
              }}>
                Ask anything...
              </div>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
              }}>
                ↑
              </div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </AbsoluteFill>
  );
};
