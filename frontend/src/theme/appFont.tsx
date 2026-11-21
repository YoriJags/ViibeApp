/**
 * The app's font, applied everywhere from one place.
 *
 * Founder's choice (21 Nov 2026): Space Grotesk for big numbers and titles,
 * Inter for everything else. React Native has no default font setting, and
 * the app has hundreds of text styles that only set a size and a weight, so
 * instead of editing each one this wraps Text once at startup:
 *
 *   20px and up  ->  Space Grotesk   (scores like "82 LIT", venue titles)
 *   under 20px   ->  Inter           (labels, body, buttons)
 *
 * The weight picks the matching font file. Custom fonts on Android need one
 * family per weight; asking for "Inter" plus fontWeight 700 would fall back to
 * a fake bold. Any text that already names a fontFamily (icons, monospace) is
 * left alone. Space Grotesk stops at 700, so heavier weights draw at 700.
 *
 * installAppFont() must run before the first render (app/_layout.tsx).
 */
import React from 'react';
import * as RN from 'react-native';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  Inter_400Regular_Italic, Inter_700Bold_Italic,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

/** Passed to useFonts in the root layout. */
export const APP_FONTS = {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  Inter_400Regular_Italic, Inter_700Bold_Italic,
  SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
};

export const DISPLAY_FROM_PX = 20;

const INTER: Record<number, string> = {
  400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold',
  700: 'Inter_700Bold', 800: 'Inter_800ExtraBold', 900: 'Inter_900Black',
};
const GROTESK: Record<number, string> = {
  400: 'SpaceGrotesk_400Regular', 500: 'SpaceGrotesk_500Medium',
  600: 'SpaceGrotesk_600SemiBold', 700: 'SpaceGrotesk_700Bold',
};

function weightOf(w: RN.TextStyle['fontWeight']): number {
  if (w === 'bold') return 700;
  const n = typeof w === 'number' ? w : parseInt(String(w ?? '400'), 10);
  if (!Number.isFinite(n)) return 400;
  return Math.min(900, Math.max(400, Math.round(n / 100) * 100)); // below 400 reads as regular
}

/** The family for a style, or null to leave the style as it is. */
export function familyFor(style: RN.TextStyle): string | null {
  if (style.fontFamily) return null;
  const weight = weightOf(style.fontWeight);
  const size = typeof style.fontSize === 'number' ? style.fontSize : 14;
  if (size >= DISPLAY_FROM_PX) return GROTESK[Math.min(weight, 700)];
  if (style.fontStyle === 'italic') return weight >= 600 ? 'Inter_700Bold_Italic' : 'Inter_400Regular_Italic';
  return INTER[weight];
}

let installed = false;

export function installAppFont(): void {
  if (installed) return;
  installed = true;
  const BaseText = RN.Text;

  const AppText = React.forwardRef<any, RN.TextProps>(function AppText(props, ref) {
    const flat = (RN.StyleSheet.flatten(props.style) || {}) as RN.TextStyle;
    const family = familyFor(flat);
    if (!family) return <BaseText ref={ref} {...props} />;
    // The face carries the weight and slant, so the synthetic ones are turned off.
    const style = [props.style, { fontFamily: family, fontWeight: 'normal' as const, fontStyle: 'normal' as const }];
    return <BaseText ref={ref} {...props} style={style} />;
  });
  AppText.displayName = 'Text';

  const AnimatedAppText = RN.Animated.createAnimatedComponent(AppText);
  try {
    // Named imports compile to property reads on the real module object at
    // use time, so replacing its getters reaches every screen and component.
    // require, not the `* as RN` namespace, which can be a copy.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const exportsObject = require('react-native');
    Object.defineProperty(exportsObject, 'Text', { configurable: true, enumerable: true, get: () => AppText });
    Object.defineProperty(exportsObject.Animated, 'Text', {
      configurable: true, enumerable: true, get: () => AnimatedAppText,
    });
  } catch {
    // If the platform ever freezes these, the app keeps the system font rather than crashing.
  }
}
