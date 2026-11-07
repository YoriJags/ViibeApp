/**
 * usePlacePhoto — the venue's Google Places photo, fetched through our backend
 * so the Google key never ships in the app. Returns null when there is none.
 *
 * Google requires the photo's author attributions to be shown with it; the
 * venue screen renders them under the hero.
 */
import { useEffect, useState } from 'react';

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://vibeapp-production-1835.up.railway.app';

export type PlacePhoto = {
  url: string;
  attributions: { name: string; uri?: string }[];
  source: 'google';
};

export function usePlacePhoto(venueId: string | undefined, enabled = true): PlacePhoto | null {
  const [photo, setPhoto] = useState<PlacePhoto | null>(null);

  useEffect(() => {
    if (!venueId || !enabled) return;
    let cancelled = false;
    fetch(`${API_URL}/api/venues/${venueId}/photo`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.photo?.url) setPhoto(d.photo); })
      .catch(() => { /* no photo is fine; the placeholder stays */ });
    return () => { cancelled = true; };
  }, [venueId, enabled]);

  return photo;
}
