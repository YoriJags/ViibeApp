/**
 * The energy ladder, in one place. docs/ENERGY.md defines the states; this
 * file gives each one its colour so a venue is the same colour on the map,
 * the list, the venue screen, the swipe decks and the city bar.
 *
 * Six states, lowest to highest: QUIET, CHILL, WARMING, CHARGED, LIT, PEAK.
 * CHARGED is WARMING's score in a room that is already full.
 */
import { energy as tokenEnergy } from './tokens';

export type EnergyState = 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';

export const ENERGY_ORDER: EnergyState[] = ['quiet', 'chill', 'warming', 'charged', 'lit', 'peak'];

// Ironbow, the scale a thermal camera uses: the same brand as the landing site
// and the organiser page (founder decision, 9 Nov 2026). These are the "ink"
// values from tokens.ts, so every state reads as text (AA on dark surfaces);
// tokens.energy[state].fill is the deeper version for large fills.
export const ENERGY_COLORS: Record<EnergyState, string> = {
  peak:    tokenEnergy.peak.ink,
  lit:     tokenEnergy.lit.ink,
  charged: tokenEnergy.charged.ink,
  warming: tokenEnergy.warming.ink,
  chill:   tokenEnergy.chill.ink,
  quiet:   tokenEnergy.quiet.ink,
};

export const ENERGY_LABELS: Record<EnergyState, string> = {
  peak: 'PEAK', lit: 'LIT', charged: 'CHARGED', warming: 'WARMING', chill: 'CHILL', quiet: 'QUIET',
};

/** Normalise whatever the server or an old record calls the state. */
export function asEnergyState(level?: string | null): EnergyState {
  const l = (level || '').toLowerCase();
  if (l === 'electric') return 'peak';          // the pre-rename name of peak
  return (ENERGY_ORDER as string[]).includes(l) ? (l as EnergyState) : 'quiet';
}

/** The state for a score, per docs/ENERGY.md. */
export function energyStateFor(score: number, capacity?: string | null): EnergyState {
  if (score >= 85) return 'peak';
  if (score >= 65) return 'lit';
  if (score >= 45) return capacity === 'full' ? 'charged' : 'warming';
  if (score >= 20) return 'chill';
  return 'quiet';
}

export const energyColor = (level?: string | null): string => ENERGY_COLORS[asEnergyState(level)];
