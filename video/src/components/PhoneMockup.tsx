import React from 'react';
import { C } from '../theme';

interface PhoneMockupProps {
  children: React.ReactNode;
  scale?: number;
  glowColor?: string;
  translateY?: number;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  scale = 1,
  glowColor = C.pink,
  translateY = 0,
}) => {
  const W = 370;
  const H = 760;

  return (
    <div
      style={{
        width: W * scale,
        height: H * scale,
        borderRadius: 44 * scale,
        border: `1.5px solid rgba(255,255,255,0.1)`,
        background: C.bgCard,
        position: 'relative',
        overflow: 'hidden',
        transform: `translateY(${translateY}px)`,
        boxShadow: [
          `0 0 60px ${glowColor}30`,
          `0 0 120px ${glowColor}12`,
          `0 40px 100px rgba(0,0,0,0.7)`,
          `inset 0 1px 0 rgba(255,255,255,0.06)`,
        ].join(', '),
        flexShrink: 0,
      }}
    >
      {/* Dynamic Island */}
      <div
        style={{
          position: 'absolute',
          top: 14 * scale,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 110 * scale,
          height: 28 * scale,
          background: '#000',
          borderRadius: 20 * scale,
          zIndex: 100,
        }}
      />
      {/* Status time */}
      <div
        style={{
          position: 'absolute',
          top: 18 * scale,
          right: 22 * scale,
          fontSize: 10 * scale,
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'system-ui',
          letterSpacing: 0.3,
          zIndex: 101,
        }}
      >
        12:30
      </div>

      {/* Screen content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          top: 50 * scale,
          bottom: 20 * scale,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>

      {/* Bottom home indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 6 * scale,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120 * scale,
          height: 4 * scale,
          background: 'rgba(255,255,255,0.25)',
          borderRadius: 4 * scale,
        }}
      />
    </div>
  );
};
