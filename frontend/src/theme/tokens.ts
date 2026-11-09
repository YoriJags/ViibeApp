/**
 * VIIBE design tokens. One file, every screen.
 *
 * Drop into frontend/src/theme/tokens.ts. New and touched code imports from
 * here only; src/theme/index.ts and floors.ts are retired screen by screen.
 *
 * Rules this file encodes (see DESIGN_SYSTEM.md):
 *  - Colour means energy. The only saturated colours in the app are the six
 *    energy states. UI chrome is ink on cold indigo, and the one accent is
 *    white-hot (primary buttons, focus, the active tab).
 *  - Six type sizes. Nothing renders below 12.
 *  - Spacing on a 4pt grid. Three radii.
 *  - No emoji as UI. Ionicons outline, three sizes.
 *
 * Fonts: add the two families once in app/_layout.tsx:
 *   npx expo install @expo-google-fonts/unbounded @expo-google-fonts/archivo
 *   const [loaded] = useFonts({ Unbounded_600SemiBold, Unbounded_700Bold,
 *     Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold });
 * Until loaded, the fallbacks below keep layout stable.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

// ─── Colour ──────────────────────────────────────────────────────────────────
// Ironbow: the scale a thermal camera uses. Same values as landing-site and
// backend/static/organiser.html, so the app, the site and the organiser
// screen read as one brand.

export const color = {
  // Surfaces, darkest to lightest. Separation comes from tone, not shadow.
  bg:        '#130A2B', // screen background (landing --cold)
  surface:   '#1B1038', // cards, sheets, tab bar (landing --cold-2)
  raised:    '#241747', // chips, inputs, pressed rows, segmented controls
  line:      'rgba(199,186,216,0.14)', // hairlines, card borders
  lineStrong:'rgba(199,186,216,0.28)', // secondary-button outline, focused input
  scrim:     'rgba(10,5,24,0.72)',      // behind sheets and modals

  // Text. Ratios are against bg / surface / raised.
  ink:       '#FFF5DE', // primary text        17.5 / 16.4 / 15.0
  inkSoft:   '#C7BAD8', // secondary text      10.4 /  9.7 /  8.9
  inkFaint:  '#8E7FA6', // tertiary, captions   5.2 /  4.9 /  4.5  (AA at every size)
  inkOnAccent:'#130A2B',// text on white-hot   17.5

  // The one accent. White-hot is the top of the energy scale, so the accent
  // and the brand are the same idea: the hottest thing on screen is what to tap.
  accent:    '#FFF5DE',
  accentPressed: '#FFBE3B',

  // Status. Used for errors and confirmations only, never decoration.
  danger:    '#FF7A6B', // 7.5 on bg
  success:   '#7BD88F', // 10.9 on bg. Confirmations only (reading sent).
} as const;

// ─── Energy ──────────────────────────────────────────────────────────────────
// docs/ENERGY.md defines the states; this gives each one two values:
//   fill: map glow, bars, dots, the score ring. Never used for small text.
//   ink:  the state word and score as text. All pass AA 4.5:1 on `raised`.
// Quiet is also drawn as a hollow ring wherever it appears as a dot, so the
// scale reads without colour.
//
// Replaces ENERGY_COLORS in src/theme/energy.ts (founder decision, see
// DESIGN_SYSTEM.md §2.3). Old values for reference: peak #FF3366, lit #FF8C00,
// charged #9933FF, warming #6655FF, chill #3399FF, quiet #6B7080. Three of
// those failed AA as text (warming 3.9, charged 3.9, quiet 3.9).

export type EnergyState = 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';

export const energy: Record<EnergyState, { fill: string; ink: string; label: string }> = {
  quiet:   { fill: '#4A3F66', ink: '#9A8FB3', label: 'Quiet' },   // ink 6.3
  chill:   { fill: '#5B2A9E', ink: '#A98BE0', label: 'Chill' },   // ink 6.7
  warming: { fill: '#B3216B', ink: '#F05AA0', label: 'Warming' }, // ink 6.0
  charged: { fill: '#E23B4E', ink: '#FF6F7E', label: 'Charged' }, // ink 7.1
  lit:     { fill: '#FF5A1F', ink: '#FF7A45', label: 'Lit' },     // ink 7.3
  peak:    { fill: '#FFBE3B', ink: '#FFD27A', label: 'Peak' },    // ink 13.3
};

/** No reading, or the reading expired. Not a state: the absence of one. */
export const noReading = { fill: 'transparent', ring: '#8E7FA6', ink: '#8E7FA6', label: 'No reading yet' };

/** The full scale as gradient stops, cold to white-hot (map heat, scale bars). */
export const ironbowStops = ['#1B1038', '#3A1566', '#B3216B', '#FF5A1F', '#FFBE3B', '#FFF5DE'] as const;

// ─── Type ────────────────────────────────────────────────────────────────────
// Unbounded for numbers and titles (the brand voice), Archivo for everything
// you read. Six sizes: 44, 28, 20, 16, 14, 12.

const display = Platform.select({ web: 'Unbounded, "Arial Black", system-ui', default: undefined });
const body = Platform.select({ web: 'Archivo, "Helvetica Neue", Arial, system-ui', default: undefined });

export const font = {
  display600: Platform.OS === 'web' ? display : 'Unbounded_600SemiBold',
  display700: Platform.OS === 'web' ? display : 'Unbounded_700Bold',
  body400:    Platform.OS === 'web' ? body : 'Archivo_400Regular',
  body500:    Platform.OS === 'web' ? body : 'Archivo_500Medium',
  body600:    Platform.OS === 'web' ? body : 'Archivo_600SemiBold',
} as const;

export const type = {
  /** The score on a venue screen. One per screen. */
  display:  { fontFamily: font.display700, fontWeight: '700', fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  /** Screen titles, venue name. */
  headline: { fontFamily: font.display700, fontWeight: '700', fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  /** Section titles, sheet titles, scores in rows. */
  title:    { fontFamily: font.display600, fontWeight: '600', fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  /** Body copy, row titles (use body600 for row titles). */
  body:     { fontFamily: font.body400, fontWeight: '400', fontSize: 16, lineHeight: 24 },
  bodyStrong:{ fontFamily: font.body600, fontWeight: '600', fontSize: 16, lineHeight: 22 },
  /** Buttons, chips, row metadata, tab labels on wide phones. */
  label:    { fontFamily: font.body500, fontWeight: '500', fontSize: 14, lineHeight: 20 },
  labelStrong:{ fontFamily: font.body600, fontWeight: '600', fontSize: 14, lineHeight: 20 },
  /** Timestamps, footnotes, tab labels. The floor: nothing smaller. */
  caption:  { fontFamily: font.body400, fontWeight: '400', fontSize: 12, lineHeight: 16 },
  captionStrong:{ fontFamily: font.body600, fontWeight: '600', fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

// ─── Space, radius, size ─────────────────────────────────────────────────────

/** 4pt grid. Use the names, not the numbers. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16, // screen gutter, card padding
  lg: 24, // between sections
  xl: 32,
  xxl: 48,
} as const;

export const gutter = space.md;

/** Three radii. sm: chips inside cards, inputs, thumbnails. md: cards, sheets. pill: buttons, pills, avatars. */
export const radius = {
  sm: 8,
  md: 16,
  pill: 999,
} as const;

export const size = {
  touch: 44,        // minimum hit target
  buttonHeight: 52, // primary and secondary buttons
  buttonHeightSm: 36,
  rowMin: 64,       // list row minimum height
  topBar: 56,       // screen header, excluding the status bar inset
  tabBar: 56,       // tab bar, excluding the home-indicator inset
  thumb: 48,        // venue thumbnail in a row
  dot: 10,          // energy dot in a row or legend
} as const;

export const icon = {
  sm: 16, // inline with caption or label text
  md: 20, // default: buttons, row trailing chevrons, header actions
  lg: 24, // tab bar, empty-state glyph inside a 48 circle
} as const;

// ─── Elevation ───────────────────────────────────────────────────────────────
// Cards never cast shadows; tone does the work. Shadows only for things that
// float over content: bottom sheets, the map's floating controls, toasts.

export const elevation = {
  none: {} as ViewStyle,
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  } as ViewStyle,
};

// ─── Motion ──────────────────────────────────────────────────────────────────
// Motion answers a tap or shows a change in a reading. Nothing loops on its own
// except the live dot on a venue read in the last 10 minutes.

export const motion = {
  fast: 120,   // press feedback
  base: 220,   // sheet snap, tab switch
  slow: 420,   // score change count-up
} as const;

// ─── Component presets ───────────────────────────────────────────────────────
// The shapes every screen composes from. See DESIGN_SYSTEM.md §4.

export const card: ViewStyle = {
  backgroundColor: color.surface,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.line,
  padding: space.md,
};

export const buttonPrimary: ViewStyle = {
  height: size.buttonHeight,
  borderRadius: radius.pill,
  backgroundColor: color.accent,
  paddingHorizontal: space.lg,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: space.xs,
};
export const buttonPrimaryText: TextStyle = { ...type.labelStrong, fontSize: 16, color: color.inkOnAccent };

export const buttonSecondary: ViewStyle = {
  ...buttonPrimary,
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderColor: color.lineStrong,
};
export const buttonSecondaryText: TextStyle = { ...type.labelStrong, fontSize: 16, color: color.ink };

export const chip: ViewStyle = {
  height: 32,
  borderRadius: radius.pill,
  backgroundColor: color.raised,
  paddingHorizontal: space.sm,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
};
export const chipText: TextStyle = { ...type.label, color: color.inkSoft };
export const chipSelected: ViewStyle = { backgroundColor: color.accent };
export const chipSelectedText: TextStyle = { color: color.inkOnAccent };

export const listRow: ViewStyle = {
  minHeight: size.rowMin,
  paddingVertical: space.sm,
  paddingHorizontal: gutter,
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.sm,
};

export const hairline: ViewStyle = { height: 1, backgroundColor: color.line, marginLeft: gutter };

export const sheet: ViewStyle = {
  backgroundColor: color.surface,
  borderTopLeftRadius: radius.md,
  borderTopRightRadius: radius.md,
  ...elevation.float,
};
export const sheetHandle: ViewStyle = {
  width: 36, height: 4, borderRadius: 2, backgroundColor: color.lineStrong,
  alignSelf: 'center', marginTop: space.xs, marginBottom: space.xs,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Energy for a venue, or the no-reading look when the reading is missing or expired. */
export function energyLook(state: EnergyState | null | undefined, fresh: boolean) {
  if (!state || !fresh) return { ...noReading, state: null as EnergyState | null };
  return { ...energy[state], ring: energy[state].fill, state };
}

/** "Read 12 min ago" / "Read 2 h ago". The age of a reading is always shown next to it. */
export function readingAge(minsAgo?: number | null): string {
  if (minsAgo == null) return 'No reading yet';
  if (minsAgo < 1) return 'Read just now';
  if (minsAgo < 60) return `Read ${Math.round(minsAgo)} min ago`;
  return `Read ${Math.round(minsAgo / 60)} h ago`;
}

export const tokens = { color, energy, noReading, ironbowStops, font, type, space, gutter, radius, size, icon, elevation, motion };
export default tokens;
