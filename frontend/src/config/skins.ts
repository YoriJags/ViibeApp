/**
 * VibeReactor Skin System
 *
 * Each skin defines a 5-color palette mapped to energy levels:
 * [dormant, stirring, buzzing, popping, electric]
 *
 * Custom skins (VIBE+ only) derive a palette from a user-supplied hex.
 */

export interface SkinPreset {
  key:     string;
  name:    string;
  preview: string;          // single color shown in picker
  palette: [string, string, string, string, string];
  vibePlus?: boolean;       // if true, requires Vibe+
}

export const SKIN_PRESETS: SkinPreset[] = [
  {
    key:     'default',
    name:    'Default',
    preview: '#5544FF',
    palette: ['#3A3A4E', '#5544FF', '#AA00FF', '#FF7700', '#FF0055'],
  },
  {
    key:     'gold',
    name:    'Gold',
    preview: '#FFD700',
    palette: ['#1C1400', '#7A5800', '#C49200', '#FFD700', '#FFF4A0'],
  },
  {
    key:     'emerald',
    name:    'Emerald',
    preview: '#00E676',
    palette: ['#001A0C', '#005C30', '#00A055', '#00E676', '#A8FFD8'],
  },
  {
    key:     'arctic',
    name:    'Arctic',
    preview: '#00C8FF',
    palette: ['#001828', '#004E80', '#0092CC', '#00C8FF', '#AAEEFF'],
  },
  {
    key:     'rose',
    name:    'Rose',
    preview: '#FF0088',
    palette: ['#1A0010', '#6A003A', '#C00068', '#FF0088', '#FFB0DC'],
  },
  {
    key:     'void',
    name:    'Void',
    preview: '#9B59B6',
    palette: ['#06030E', '#1C0A3A', '#4A1680', '#9B59B6', '#D8A8FF'],
  },
  {
    key:     'inferno',
    name:    'Inferno',
    preview: '#FF6D00',
    palette: ['#1A0800', '#7A2E00', '#CC5500', '#FF6D00', '#FFD4A0'],
  },
  {
    key:     'custom',
    name:    'Custom',
    preview: '#FFFFFF',
    palette: ['#111111', '#333333', '#666666', '#AAAAAA', '#FFFFFF'],
    vibePlus: true,
  },
];

/** Look up a preset by key, falling back to default. */
export function getSkinPreset(key: string): SkinPreset {
  return SKIN_PRESETS.find(s => s.key === key) ?? SKIN_PRESETS[0];
}

/**
 * Derive a 5-stop palette from any hex color.
 * Produces [very-dark, dark, mid, bright, near-white] tones of the hue.
 */
export function hexToLevelPalette(hex: string): [string, string, string, string, string] {
  const c = hexToRgb(hex);
  if (!c) return SKIN_PRESETS[0].palette;

  const blend = (ratio: number, toWhite = false): string => {
    const bg = toWhite ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
    const r = Math.round(c.r * ratio + bg.r * (1 - ratio));
    const g = Math.round(c.g * ratio + bg.g * (1 - ratio));
    const b = Math.round(c.b * ratio + bg.b * (1 - ratio));
    return rgbToHex(r, g, b);
  };

  return [
    blend(0.12),           // dormant  — near-black tint
    blend(0.42),           // stirring — dark saturated
    blend(0.72),           // buzzing  — mid tone
    hex,                   // popping  — full color
    blend(0.55, true),     // electric — pale pastel towards white
  ];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve any skin key (preset or 'custom:#RRGGBB') to its 5-color palette.
 */
export function resolveSkinPalette(
  skinKey: string | undefined,
): [string, string, string, string, string] {
  if (!skinKey) return SKIN_PRESETS[0].palette;

  if (skinKey.startsWith('custom:')) {
    const hex = skinKey.slice(7);
    return hexToLevelPalette(hex);
  }

  return getSkinPreset(skinKey).palette;
}
