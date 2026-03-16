/**
 * NarrativeDivider — Cinematic section break.
 *
 * Creates a felt pause between acts on any screen.
 * Three modes:
 *   "chapter"  — labeled break with gradient line + optional scene label
 *   "scene"    — lighter version, subtle label only
 *   "breath"   — invisible spacing with atmospheric glow, no text
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface NarrativeDividerProps {
  mode?:    'chapter' | 'scene' | 'breath';
  label?:   string;
  color?:   string;
  topGap?:  number;
  botGap?:  number;
}

export default function NarrativeDivider({
  mode    = 'chapter',
  label,
  color   = 'rgba(255,255,255,0.12)',
  topGap  = 8,
  botGap  = 8,
}: NarrativeDividerProps) {

  if (mode === 'breath') {
    return (
      <View style={{ height: topGap + botGap + 8 }}>
        {/* Barely visible atmospheric glow band — like heat haze */}
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.015)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  if (mode === 'scene') {
    return (
      <View style={[s.sceneWrap, { marginTop: topGap, marginBottom: botGap }]}>
        {label && (
          <Text style={[s.sceneLabel, { color: typeof color === 'string' && color.startsWith('#') ? color + '55' : 'rgba(255,255,255,0.18)' }]}>
            {label.toUpperCase()}
          </Text>
        )}
        <View style={s.sceneLine}>
          <LinearGradient
            colors={['transparent', color, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
    );
  }

  // chapter (default)
  const lineColor = typeof color === 'string' && color.startsWith('#')
    ? color
    : 'rgba(255,255,255,0.10)';
  const textColor = typeof color === 'string' && color.startsWith('#')
    ? color + '90'
    : 'rgba(255,255,255,0.22)';

  return (
    <View style={[s.chapterWrap, { marginTop: topGap, marginBottom: botGap }]}>
      {/* Top gradient fade — atmospheric depth */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.06)', 'transparent']}
        style={s.atmosLayer}
      />

      <View style={s.chapterRow}>
        {/* Left line */}
        <View style={s.lineSide}>
          <LinearGradient
            colors={['transparent', lineColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Center label */}
        {label ? (
          <View style={[s.labelWrap, { borderColor: lineColor }]}>
            <Text style={[s.labelText, { color: textColor }]}>{label.toUpperCase()}</Text>
          </View>
        ) : (
          <View style={[s.dotWrap]}>
            <View style={[s.dot, { backgroundColor: lineColor }]} />
          </View>
        )}

        {/* Right line */}
        <View style={s.lineSide}>
          <LinearGradient
            colors={[lineColor, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Chapter
  chapterWrap: {
    paddingHorizontal: 16,
    position: 'relative',
  },
  atmosLayer: {
    position: 'absolute',
    left: 0, right: 0, top: -12, height: 40,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lineSide: {
    flex: 1,
    height: 0.5,
    position: 'relative',
    overflow: 'hidden',
  },
  labelWrap: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5,
    backgroundColor: '#08080F',
  },
  labelText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  dotWrap: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  // Scene
  sceneWrap: {
    paddingHorizontal: 16,
    gap: 6,
  },
  sceneLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 3,
    paddingLeft: 2,
  },
  sceneLine: {
    height: 0.5,
    position: 'relative',
    overflow: 'hidden',
  },
});
