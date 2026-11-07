/**
 * usePlacePhoto — the venue's Google Places photo, fetched through our backend
 * so the Google key never ships in the app. Returns null when there is none.
 *
 * Google requires the photo's author attributions to be shown with it; every
 * place that renders the photo also renders photoCredit().
 *
 * Results are kept for the session, and concurrent requests for the same venue
 * share one fetch, so a list of cards does not refetch on every scroll.
 */
import { useEffect, useState } from 'react';

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://vibeapp-production-1835.up.railway.app';

export type PlacePhoto = {
  url: string;
  attributions: { name: string; uri?: string }[];
  source: 'google';
};

// Photo URLs from Google are short-lived; the server hands out fresh ones for
// under an hour, so the app keeps them for less than that.
const KEEP_MS = 40 * 60 * 1000;
const cache = new Map<string, { at: number; photo: PlacePhoto | null }>();
const inFlight = new Map<string, Promise<PlacePhoto | null>>();

function load(venueId: string): Promise<PlacePhoto | null> {
  const hit = cache.get(venueId);
  if (hit && Date.now() - hit.at < KEEP_MS) return Promise.resolve(hit.photo);
  const pending = inFlight.get(venueId);
  if (pending) return pending;
  const p = fetch(`${API_URL}/api/venues/${venueId}/photo`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.photo?.url ? (d.photo as PlacePhoto) : null))
    .catch(() => null)
    .then((photo) => {
      cache.set(venueId, { at: Date.now(), photo });
      inFlight.delete(venueId);
      return photo;
    });
  inFlight.set(venueId, p);
  return p;
}

export function usePlacePhoto(venueId: string | undefined, enabled = true): PlacePhoto | null {
  const [photo, setPhoto] = useState<PlacePhoto | null>(() => {
    const hit = venueId ? cache.get(venueId) : undefined;
    return hit && Date.now() - hit.at < KEEP_MS ? hit.photo : null;
  });

  useEffect(() => {
    if (!venueId || !enabled) return;
    let cancelled = false;
    load(venueId).then((p) => { if (!cancelled) setPhoto(p); });
    return () => { cancelled = true; };
  }, [venueId, enabled]);

  return enabled ? photo : null;
}

/** The credit Google requires next to its photos. */
export function photoCredit(photo: PlacePhoto): string {
  const names = photo.attributions.map((a) => a.name).filter(Boolean);
  return names.length ? `Photo: ${names.join(', ')} · Google` : 'Photo · Google';
}
