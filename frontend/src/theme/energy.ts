/**
 * The energy ladder, in one place. docs/ENERGY.md defines the states; this
 * file gives each one its colour so a venue is the same colour on the map,
 * the list, the venue screen, the swipe decks and the city bar.
 *
 * Six states, lowest to highest: QUIET, CHILL, WARMING, CHARGED, LIT, PEAK.
 * CHARGED is WARMING's score in a room that is already full.
 */
export type EnergyState = 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';

export const ENERGY_ORDER: EnergyState[] = ['quiet', 'chill', 'warming', 'charged', 'lit', 'peak'];

export const ENERGY_COLORS: Record<EnergyState, string> = {
  peak:    '#FF3366',
  lit:     '#FF8C00',
  charged: '#9933FF',
  warming: '#6655FF',
  chill:   '#3399FF',
  // Light enough to read as text on the dark backgrounds (about 3.9:1 on #0E0E1A).
  quiet:   '#6B7080',
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
