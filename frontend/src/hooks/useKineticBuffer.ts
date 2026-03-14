/**
 * useKineticBuffer — Crowd coherence from tap interval variance.
 *
 * Maintains a sliding buffer of tap_variance readings (one per bolt window).
 * Derives a smooth syncPct (0–100) using an exponential moving average so
 * the ring doesn't spike jerkily.
 *
 * syncPct = 0   → chaotic individual tapping, ring stays dashed / flickery
 * syncPct = 100 → entire room tapping in lock-step, ring crystallises to a
 *                 solid glowing arc
 *
 * isSynchronized fires when syncPct crosses 65 — triggers haptic + ring
 * crystallisation in the VibeReactor.
 *
 * Usage:
 *   const { syncPct, isCoherent, recordVariance } = useKineticBuffer();
 *   // call recordVariance(tapVariance) after each bolt's variance is computed
 */
import { useRef, useState, useCallback } from 'react';

const BUFFER_SIZE          = 12;    // last 12 variance readings (~recent history)
const COHERENT_THRESHOLD   = 65;    // syncPct above this = synchronized crowd
const CHAOS_CEILING        = 1.0;   // variance at or above this = 0% sync
const EMA_ALPHA            = 0.30;  // exponential moving average smoothing
const RERENDER_MIN_DELTA   = 3;     // don't re-render unless syncPct shifts ≥3pts

export interface KineticBufferResult {
  /** 0–100: how synchronized the crowd is right now */
  syncPct:      number;
  /** true when syncPct > 65 — crowd is locked in */
  isCoherent:   boolean;
  /** Call this after computing tapVariance in handleTap */
  recordVariance: (variance: number) => void;
}

export function useKineticBuffer(): KineticBufferResult {
  const bufferRef  = useRef<number[]>([]);
  const emaRef     = useRef<number>(0);
  const [syncPct, setSyncPct] = useState(0);

  const recordVariance = useCallback((variance: number) => {
    const buf = bufferRef.current;

    // Clamp to [0, CHAOS_CEILING]
    const clamped = Math.min(Math.max(variance, 0), CHAOS_CEILING);

    // Push into circular buffer
    buf.push(clamped);
    if (buf.length > BUFFER_SIZE) buf.shift();

    // Average variance across the buffer
    const avgVariance = buf.reduce((a, b) => a + b, 0) / buf.length;

    // Raw sync score: low variance = high sync
    const rawSync = Math.max(0, (1 - avgVariance / CHAOS_CEILING) * 100);

    // Exponential moving average for smooth transitions
    const newEma = emaRef.current * (1 - EMA_ALPHA) + rawSync * EMA_ALPHA;
    emaRef.current = newEma;

    const rounded = Math.round(newEma);

    setSyncPct(prev => {
      if (Math.abs(prev - rounded) < RERENDER_MIN_DELTA) return prev;
      return rounded;
    });
  }, []);

  return {
    syncPct,
    isCoherent: syncPct > COHERENT_THRESHOLD,
    recordVariance,
  };
}
