/**
 * Insider Mode Selectors
 *
 * Transforms raw Venue data into human-readable "Scene Intel Sentences"
 * for users in 'insider' mode — clean, no gamification language.
 *
 * Example output:
 *   "Quilox is packed; DJ just dropped; 15 min gate delay; heating up fast"
 */

import { Venue, CityPulseData } from '../types';

// ─── Venue sentence fragments ─────────────────────────────────────────────────

function describeCapacity(level: Venue['capacity_level'], score: number): string {
  const pct = Math.round(score);
  switch (level) {
    case 'sparse':  return `${pct < 30 ? 'quiet tonight' : 'light crowd'}`;
    case 'vibrant': return `${pct}% capacity`;
    case 'full':    return `packed (${pct}%+)`;
    default:        return `${pct}% capacity`;
  }
}

function describeEnergy(level: Venue['energy_level']): string {
  switch (level) {
    case 'quiet':   return 'very low energy';
    case 'chill':   return 'mellow vibe';
    case 'warming': return 'warming up';
    case 'charged': return 'crowd is charged';
    case 'lit':     return 'DJ just dropped';
    case 'peak':    return 'peak energy right now';
    default:        return '';
  }
}

function describeGate(level: Venue['gate_level']): string | null {
  switch (level) {
    case 'clear':   return null; // not worth mentioning
    case 'slow':    return '10–20 min gate delay';
    case 'blocked': return 'heavy queue — 30+ min wait';
    default:        return null;
  }
}

function describeVelocity(velocity: Venue['vibe_velocity']): string | null {
  switch (velocity) {
    case 'heating_up':   return 'heating up fast';
    case 'cooling_down': return 'crowd thinning';
    case 'stable':       return null; // not worth mentioning
    default:             return null;
  }
}

// ─── Main selector ────────────────────────────────────────────────────────────

/**
 * Returns a concise scene intel sentence for a venue in Insider Mode.
 * Parts are joined with "; " and trailing noise is omitted.
 */
export function getSceneIntelSentence(venue: Venue): string {
  const parts: string[] = [];

  parts.push(describeCapacity(venue.capacity_level, venue.current_vibe_score));

  const energy = describeEnergy(venue.energy_level);
  if (energy) parts.push(energy);

  const gate = describeGate(venue.gate_level);
  if (gate) parts.push(gate);

  const velocity = describeVelocity(venue.vibe_velocity);
  if (velocity) parts.push(velocity);

  if (venue.ratings_last_30m && venue.ratings_last_30m > 10) {
    parts.push(`${venue.ratings_last_30m} scouts active`);
  }

  return parts.length > 0
    ? `${venue.name} — ${parts.join('; ')}`
    : venue.name;
}

/**
 * Returns intel sentences for a list of venues, sorted by score descending.
 * Filters to top N (default 5) for the feed.
 */
export function getTopSceneIntel(venues: Venue[], limit = 5): string[] {
  return [...venues]
    .sort((a, b) => b.current_vibe_score - a.current_vibe_score)
    .slice(0, limit)
    .map(getSceneIntelSentence);
}

// ─── City pulse sentence ──────────────────────────────────────────────────────

/**
 * Returns a city-level intel summary for Insider Mode header.
 * Example: "Lagos is lit — 42 scouts active across 12 venues"
 */
export function getCityPulseIntel(pulse: CityPulseData | null): string {
  if (!pulse) return 'Loading city pulse…';

  const cityName = pulse.city.charAt(0).toUpperCase() + pulse.city.slice(1);

  const moodMap: Record<string, string> = {
    QUIET:   'quiet tonight',
    CHILL:   'warming up',
    WARMING: 'getting lively',
    LIT:     'lit right now',
    PEAK:    'at peak energy',
  };
  const mood = moodMap[pulse.pulse_label] ?? 'active';

  const trendMap: Record<string, string> = {
    heating_up:   ', and heating up fast',
    cooling_down: ', and winding down',
    stable:       '',
  };
  const trend = trendMap[pulse.trend] ?? '';

  return `${cityName} is ${mood}${trend} — ${pulse.active_scouts} scouts, ${pulse.live_venues} live venues`;
}

// ─── Mode-aware display helper ────────────────────────────────────────────────

/**
 * Returns the correct display label for a vibe score depending on userMode.
 * Scout: shows numeric score + flame. Insider: shows prose label.
 */
export function getVibeDisplay(
  venue: Venue,
  userMode: 'scout' | 'insider' | null,
): { label: string; isNumeric: boolean } {
  if (userMode === 'insider') {
    const labels: Record<Venue['energy_level'], string> = {
      quiet:   'Dead',
      chill:   'Chill',
      warming: 'Warming',
      charged: 'Charged',
      lit:     'Lit',
      peak:    'Electric',
    };
    return { label: labels[venue.energy_level] ?? 'Active', isNumeric: false };
  }
  // Scout mode (default): numeric score
  return { label: `${Math.round(venue.current_vibe_score)}`, isNumeric: true };
}
