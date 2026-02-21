export const C = {
  bg: '#070710',
  bgCard: '#0D0D1A',
  bgCardAlt: 'rgba(255,255,255,0.04)',
  pink: '#FF3366',
  purple: '#9933FF',
  cyan: '#00D4FF',
  gold: '#FFD700',
  orange: '#FF6B35',
  green: '#00E676',
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.55)',
  subtle: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.08)',
} as const;

export const font = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const gradientText = (from: string, to: string): React.CSSProperties => ({
  backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

// Common easing presets
export const ease = {
  out: [0, 0, 0.25, 1] as [number, number, number, number],
};

import React from 'react';
