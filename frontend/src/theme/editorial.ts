/**
 * Direction 1, Editorial Night (picked 21 Nov 2026, with Direction 2's rings
 * on live numbers). New and restyled screens import from here; older screens
 * move over one at a time.
 *
 * Warm black surfaces, ink text, one brand pink for the thing to tap and for
 * Certified. Energy colours stay in tokens.ts and are only used for readings.
 * Fonts come from src/theme/appFont.tsx: 20px and up is Space Grotesk.
 */
import { TextStyle } from 'react-native';

export const ed = {
  bg: '#0A090D',
  surface: '#141218',
  raised: '#1D1A23',
  line: 'rgba(255,245,222,0.10)',
  lineStrong: 'rgba(255,245,222,0.24)',
  ink: '#FFF5DE',
  inkSoft: '#C9C2D6',
  inkFaint: '#8F889E',
  pink: '#FF3366',
  pinkSoft: 'rgba(255,51,102,0.14)',
  gold: '#FFBE3B',
  goldSoft: 'rgba(255,190,59,0.14)',
  success: '#7BD88F',
  danger: '#FF7A6B',
} as const;

export const edType = {
  hero: { fontSize: 44, lineHeight: 46, fontWeight: '700', letterSpacing: -1.2, color: ed.ink },
  headline: { fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6, color: ed.ink },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2, color: ed.ink },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', color: ed.inkSoft },
  bodyStrong: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: ed.ink },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: ed.ink },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', color: ed.inkFaint },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.6, color: ed.inkFaint, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

export const edSpace = { gutter: 20, shelf: 32, xs: 6, sm: 10, md: 16, lg: 24 } as const;
export const edRadius = { sm: 8, md: 16, pill: 999 } as const;
