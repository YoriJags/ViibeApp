/**
 * The city grid for the map's hex layer (backend routes/grid.py).
 *
 * Fetches the three resolutions the map switches between as you zoom (city,
 * district, street corner) so the map can change scale without a round trip.
 * The server folds venues into cells and applies the trust rules; this hook
 * only carries the result. Refreshes every minute while enabled.
 */
import { useEffect, useState } from 'react';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface GridCell {
  cell: string;
  boundary: number[][]; // closed ring, [lng, lat]
  venues: number;
  venues_read: number;
  score: number | null; // 0..100
  confidence: number | null; // 0..1
  solid: boolean;
  source: 'scouts' | 'demo' | 'none';
  decay_state: 'fresh' | 'fading' | 'stale' | 'none';
}

/** Cells keyed by H3 resolution: 7, 8 and 9. */
export type CityGrid = Record<number, GridCell[]>;

// One zoom inside each band the server maps to a resolution (see resolution_for_zoom).
const ZOOM_FOR_RES: Record<number, number> = { 7: 10, 8: 12, 9: 14 };
const REFRESH_MS = 60_000;

export function useCityGrid(city: string | null | undefined, enabled: boolean): CityGrid | null {
  const [grid, setGrid] = useState<CityGrid | null>(null);

  useEffect(() => {
    if (!enabled || !city || !API_URL) {
      setGrid(null);
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const entries = await Promise.all(
          Object.entries(ZOOM_FOR_RES).map(async ([res, zoom]) => {
            const r = await fetch(`${API_URL}/api/grid/vpixels?city=${encodeURIComponent(city)}&zoom=${zoom}`);
            if (!r.ok) throw new Error(`grid ${r.status}`);
            const body = await r.json();
            return [Number(res), (body.cells ?? []) as GridCell[]] as const;
          }),
        );
        if (live) setGrid(Object.fromEntries(entries));
      } catch {
        // No grid is an honest state: the map still shows its pins.
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [city, enabled]);

  return grid;
}
