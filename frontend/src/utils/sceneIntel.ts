/**
 * sceneIntel.ts
 *
 * Converts raw venue vibe data into a single human-readable Intel sentence
 * for the Insider Mode home feed. No emojis in the output — these are reads,
 * not notifications. Clean, confident, direct.
 *
 * Usage:
 *   import { getSceneIntel } from '@/src/utils/sceneIntel';
 *   const line = getSceneIntel(venue);
 *   // → "Mercury is packed and climbing. DJ just switched sets. Get there now."
 */

export interface SceneInput {
  name: string;
  venue_type: string;
  current_vibe_score: number;
  energy_level: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  total_ratings_24h?: number;
  bolt_velocity_15min?: number;
}

// ── Core sentence templates ─────────────────────────────────────────────────

const CROWD_DESC: Record<SceneInput['capacity_level'], string> = {
  sparse:  'light crowd',
  vibrant: 'decent crowd',
  full:    'packed',
};

const GATE_DESC: Record<SceneInput['gate_level'], string> = {
  clear:   'Walk straight in.',
  slow:    'Short wait at the door.',
  blocked: 'Long queue — factor in the wait.',
};

const VELOCITY_SUFFIX: Record<SceneInput['vibe_velocity'], string> = {
  heating_up:    'Energy is climbing.',
  cooling_down:  'Starting to wind down.',
  stable:        '',
};

// Venue-type-specific context phrases based on energy level
const VENUE_CONTEXT: Partial<Record<string, Partial<Record<SceneInput['energy_level'], string>>>> = {
  club: {
    quiet:   'Floor is quiet, DJ warming up.',
    chill:   'Early crowd forming.',
    warming: 'Building nicely.',
    charged: 'Crowd is there — waiting on the set to peak.',
    lit:     'DJ is delivering.',
    peak:    'DJ just switched sets. Floor is gone.',
  },
  rave: {
    quiet:   'Doors just opened.',
    chill:   'First wave in.',
    warming: 'Crowd is locking in.',
    charged: 'Almost there.',
    lit:     'Deep into the set now.',
    peak:    'The room is fully gone.',
  },
  bar: {
    quiet:   'Quiet tonight.',
    chill:   'Low-key, good for conversations.',
    warming: 'Decent atmosphere.',
    charged: 'Filling up fast.',
    lit:     'Loud and alive.',
    peak:    'At capacity. Expect noise.',
  },
  lounge: {
    quiet:   'Relaxed vibe.',
    chill:   'Good setting for a small group.',
    warming: 'Crowd trickling in.',
    charged: 'Feels premium tonight.',
    lit:     'Upscale and animated.',
    peak:    'At full steam. Service will be stretched.',
  },
  concert: {
    quiet:   'Crowd still filing in.',
    chill:   'Support act on.',
    warming: 'Energy building before main act.',
    charged: 'Almost headliner time.',
    lit:     'Main act is on. Crowd responding.',
    peak:    'Crowd is fully switched on.',
  },
  block_party: {
    quiet:   'Getting set up.',
    chill:   'Small crowd so far.',
    warming: 'It\'s moving.',
    charged: 'Getting thick.',
    lit:     'Road is busy.',
    peak:    'Packed. Full send.',
  },
  festival: {
    quiet:   'Early gates.',
    chill:   'Spread out, low density.',
    warming: 'Crowds spreading across stages.',
    charged: 'Main stage drawing people.',
    lit:     'Headline act pulling the crowd.',
    peak:    'Max density at main stage.',
  },
  restaurant: {
    quiet:   'Tables available.',
    chill:   'Moderate occupancy.',
    warming: 'Getting busy — reservations recommended.',
    charged: 'Almost full.',
    lit:     'Fully seated. Lively atmosphere.',
    peak:    'Fully booked, walk-ins unlikely.',
  },
};

function getVenueContext(venue_type: string, energy: SceneInput['energy_level']): string {
  const typeMap = VENUE_CONTEXT[venue_type] ?? VENUE_CONTEXT['bar']!;
  return typeMap[energy] ?? '';
}

// ── Arrival recommendation ──────────────────────────────────────────────────

function getArrivalLine(
  score: number,
  velocity: SceneInput['vibe_velocity'],
  gate: SceneInput['gate_level'],
): string {
  if (score >= 85 && velocity === 'heating_up') return 'Get there now or miss the peak.';
  if (score >= 85 && velocity === 'cooling_down') return 'Past peak — still worth it, get in quick.';
  if (score >= 85) return 'Currently at peak. Go now.';
  if (score >= 65 && velocity === 'heating_up') return 'Good time to arrive — still climbing.';
  if (score >= 65) return 'Solid right now.';
  if (score >= 45 && velocity === 'heating_up') return 'Give it 30–45 min, it\'s building.';
  if (score >= 45) return 'Warming up. Not fully there yet.';
  if (score >= 20) return 'Quiet tonight. Early options are open.';
  return 'Not the move right now.';
}

// ── Main export ─────────────────────────────────────────────────────────────

export function getSceneIntel(venue: SceneInput): string {
  const { name, venue_type, current_vibe_score, energy_level, capacity_level, gate_level, vibe_velocity, bolt_velocity_15min } = venue;

  const crowd = CROWD_DESC[capacity_level] ?? 'moderate crowd';
  const context = getVenueContext(venue_type, energy_level);
  const velocity = VELOCITY_SUFFIX[vibe_velocity] ?? '';
  const gate = GATE_DESC[gate_level] ?? '';
  const arrival = getArrivalLine(current_vibe_score, vibe_velocity, gate_level);

  // Bolt surge signal — real-time tap velocity from scouts
  const boltSignal = (bolt_velocity_15min ?? 0) >= 20
    ? 'Scouts are surging — peak incoming.'
    : (bolt_velocity_15min ?? 0) >= 10
    ? 'High bolt activity — scene is picking up.'
    : '';

  // Build sentence fragments and filter empty strings
  const parts = [
    `${name} — ${crowd}.`,
    context,
    velocity,
    boltSignal,
    gate,
    arrival,
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Short version (one line) for list cards.
 * e.g. "Packed, DJ delivering. Get there now."
 */
export function getSceneIntelShort(venue: SceneInput): string {
  const { venue_type, current_vibe_score, energy_level, capacity_level, vibe_velocity } = venue;

  const crowd = CROWD_DESC[capacity_level] ?? 'moderate crowd';
  const context = getVenueContext(venue_type, energy_level);
  const arrival = getArrivalLine(current_vibe_score, vibe_velocity, venue.gate_level);

  const parts = [
    `${crowd.charAt(0).toUpperCase() + crowd.slice(1)}, ${context.toLowerCase()}`,
    arrival,
  ].filter(s => s && s.trim().length > 0 && s !== ',');

  return parts.join(' ');
}
