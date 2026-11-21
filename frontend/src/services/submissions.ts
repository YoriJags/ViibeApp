/**
 * Events and places that people put forward (backend/app/routes/events.py,
 * places.py). Live mode talks to the API. Demo mode walks the same steps with
 * sample places and keeps what was "submitted" in memory, so the demo shows
 * every phase without touching the server.
 */
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export type EventType = 'concert' | 'festival' | 'rave' | 'block_party';
export type Entry = 'ticketed' | 'door';
export type PlaceType = 'theatre' | 'arena' | 'stadium' | 'park' | 'beach' | 'field' | 'street' | 'hall' | 'other';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  concert: 'Concert',
  festival: 'Festival',
  rave: 'Rave',
  block_party: 'Block party',
};

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  theatre: 'Theatre',
  arena: 'Arena',
  stadium: 'Stadium',
  park: 'Park',
  beach: 'Beach',
  field: 'Field',
  street: 'Street',
  hall: 'Hall',
  other: 'Other',
};

export interface Coordinates { lat: number; lng: number }

export interface PlaceResult {
  id?: string;               // VIIBE places only
  osm_id?: string;           // OpenStreetMap results only
  source: 'viibe' | 'openstreetmap' | 'here';
  name: string;
  address?: string;
  area?: string;
  place_type?: PlaceType;
  coordinates: Coordinates;
  ground_radius_m?: number;
  status?: string;
}

export interface EventDraft {
  name: string;
  venue_type: EventType;
  entry: Entry;
  starts_at: string;         // ISO with offset
  ends_at: string;
  place: PlaceResult;
  organiser_name?: string;
  ticket_url?: string;
}

export interface SubmittedEvent {
  event: {
    id: string;
    name: string;
    venue_type: EventType;
    address?: string;
    area?: string;
    starts_at: string;
    ends_at: string;
    listing?: 'community' | 'official';
  };
  status: 'pending' | 'rejected' | 'live' | 'under_review' | 'approved';
  reason?: string;
  organiser_link?: string;
}

export interface SubmittedPlace {
  place: PlaceResult & { id: string };
  status: string;
  reason?: string;
}

/** What the API said was wrong, as sentences a person can act on. */
export class SubmitError extends Error {
  problems: string[];
  existing?: { id: string; name: string };
  constructor(problems: string[], existing?: { id: string; name: string }) {
    super(problems.join(' '));
    this.problems = problems;
    this.existing = existing;
  }
}

// ── Demo ────────────────────────────────────────────────────────────────────
// Real Lagos grounds at approximate positions. The demo never sends them anywhere.

const DEMO_PLACES: PlaceResult[] = [
  { id: 'demo-place-national-theatre', source: 'viibe', name: 'National Theatre', area: 'Iganmu',
    address: 'National Theatre, Iganmu, Lagos', place_type: 'theatre',
    coordinates: { lat: 6.4766, lng: 3.37 }, ground_radius_m: 350, status: 'approved' },
  { id: 'demo-place-tbs', source: 'viibe', name: 'Tafawa Balewa Square', area: 'Lagos Island',
    address: 'Tafawa Balewa Square, Lagos Island', place_type: 'field',
    coordinates: { lat: 6.4447, lng: 3.4003 }, ground_radius_m: 400, status: 'approved' },
  { osm_id: 'demo/muri-okunola', source: 'openstreetmap', name: 'Muri Okunola Park', area: 'Victoria Island',
    address: 'Muri Okunola Park, Victoria Island, Lagos', place_type: 'park',
    coordinates: { lat: 6.4321, lng: 3.422 }, ground_radius_m: 300 },
  { osm_id: 'demo/eko-convention', source: 'openstreetmap', name: 'Eko Convention Centre', area: 'Victoria Island',
    address: 'Eko Convention Centre, Victoria Island, Lagos', place_type: 'hall',
    coordinates: { lat: 6.4255, lng: 3.4106 }, ground_radius_m: 250 },
  { osm_id: 'demo/landmark-beach', source: 'openstreetmap', name: 'Landmark Beach', area: 'Oniru',
    address: 'Landmark Beach, Oniru, Lagos', place_type: 'beach',
    coordinates: { lat: 6.4228, lng: 3.4489 }, ground_radius_m: 400 },
];

const demoEvents: SubmittedEvent[] = [
  {
    event: { id: 'demo-sub-1', name: 'Kemi Adé Live', venue_type: 'concert', area: 'Iganmu',
      address: 'National Theatre, Iganmu, Lagos',
      starts_at: eveningIn(2, 20), ends_at: eveningIn(3, 1), listing: 'official' },
    status: 'live',
    organiser_link: '/organiser/demo-sub-1?key=demo',
  },
];
const demoPlaces: SubmittedPlace[] = [];

/** A whole hour, Lagos time, a number of days from today (demo listings read like real ones). */
function eveningIn(days: number, hour: number): string {
  const lagos = new Date(Date.now() + 3600_000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + days, hour - 1)).toISOString();
}

const isDemo = () => useVibeStore.getState().isDemoMode;
const headers = () => useVibeStore.getState().getAuthHeaders();

async function readProblems(res: Response): Promise<SubmitError> {
  let body: any = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  const detail = body?.detail;
  if (res.status === 401) return new SubmitError(['Sign in again to send this.']);
  if (Array.isArray(detail?.problems)) return new SubmitError(detail.problems, detail.existing);
  if (typeof detail === 'string') return new SubmitError([detail]);
  if (typeof detail?.message === 'string') return new SubmitError([detail.message]);
  return new SubmitError([`Something went wrong (${res.status}). Try again in a minute.`]);
}

// ── Calls ───────────────────────────────────────────────────────────────────

export async function searchPlaces(q: string, city: string): Promise<PlaceResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  if (isDemo()) {
    const needle = query.toLowerCase();
    return DEMO_PLACES.filter((p) => `${p.name} ${p.area}`.toLowerCase().includes(needle));
  }
  const res = await fetch(`${API_URL}/api/places/search?q=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`);
  if (!res.ok) throw await readProblems(res);
  const body = await res.json();
  return body.results || [];
}

export async function submitEvent(draft: EventDraft, city: string): Promise<SubmittedEvent> {
  const p = draft.place;
  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    venue_type: draft.venue_type,
    entry: draft.entry,
    starts_at: draft.starts_at,
    ends_at: draft.ends_at,
    city,
    organiser_name: draft.organiser_name?.trim() || undefined,
    ticket_url: draft.ticket_url?.trim() || undefined,
  };
  if (p.source === 'viibe' && p.id) {
    payload.place_id = p.id;
  } else {
    // An OpenStreetMap result or where the person is standing: the pin goes
    // to review with the event and an admin confirms it before anyone sees it.
    payload.coordinates = p.coordinates;
    payload.address = p.address || p.name;
    payload.area = p.area || '';
    if (p.ground_radius_m) payload.geofence_radius_m = p.ground_radius_m;
  }

  if (isDemo()) {
    const item: SubmittedEvent = {
      event: { id: `demo-sub-${Date.now()}`, name: draft.name.trim(), venue_type: draft.venue_type,
        address: p.address || p.name, area: p.area, starts_at: draft.starts_at, ends_at: draft.ends_at,
        listing: 'community' },
      status: 'pending',
    };
    demoEvents.unshift(item);
    return item;
  }
  const res = await fetch(`${API_URL}/api/events/submit`, {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  });
  if (!res.ok) throw await readProblems(res);
  return res.json();
}

export interface PlaceDraft {
  name: string;
  place_type: PlaceType;
  area?: string;
  location: PlaceResult;
}

export async function submitPlace(draft: PlaceDraft, city: string): Promise<SubmittedPlace> {
  const loc = draft.location;
  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    place_type: draft.place_type,
    area: draft.area?.trim() || loc.area || '',
    address: loc.address || '',
    city,
    coordinates: loc.coordinates,
    location_source: loc.source === 'openstreetmap' ? 'openstreetmap' : 'pin',
    osm_id: loc.osm_id,
  };
  if (isDemo()) {
    const item: SubmittedPlace = {
      place: { ...loc, id: `demo-place-${Date.now()}`, source: 'viibe', name: draft.name.trim(),
        place_type: draft.place_type, status: 'pending' },
      status: 'pending',
    };
    demoPlaces.unshift(item);
    return item;
  }
  const res = await fetch(`${API_URL}/api/places`, {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  });
  if (!res.ok) throw await readProblems(res);
  const body = await res.json();
  return { place: body.place, status: body.place?.status || 'pending' };
}

export async function mySubmissions(): Promise<{ events: SubmittedEvent[]; places: SubmittedPlace[] }> {
  if (isDemo()) return { events: [...demoEvents], places: [...demoPlaces] };
  const res = await fetch(`${API_URL}/api/me/submissions`, { headers: headers() });
  if (!res.ok) throw await readProblems(res);
  return res.json();
}

/** Full URL for an organiser's live screen (served by the backend). */
export function organiserUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * The name a certified organiser lists under, or null. Their events go out as
 * Official listings under this name; anyone else's are Community listings.
 */
export async function organiserCertifiedName(): Promise<string | null> {
  if (isDemo()) return null;
  try {
    const res = await fetch(`${API_URL}/api/certification/me`, { headers: headers() });
    if (!res.ok) return null;
    const body = await res.json();
    const rec = (body.applications || []).find((a: any) => a.kind === 'organiser' && a.status === 'certified');
    return rec ? rec.name : null;
  } catch {
    return null;
  }
}
