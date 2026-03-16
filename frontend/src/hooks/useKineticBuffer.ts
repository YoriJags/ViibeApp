/**
 * useKineticBuffer — Hybrid personal rhythm + crowd coherence.
 *
 * Two signals, one display metric:
 *   personalRhythm  — how consistently YOU are tapping (solo-viable)
 *   crowdCoherence  — variance from the bolt window (climbs with real crowd)
 *   syncPct         — max(personalRhythm, crowdCoherence)
 *
 * Personal rhythm uses G-force weighted CoV:
 *   Physical, body-led taps weight more than wrist-flick taps.
 *   A scout moving to the music earns sync faster than someone tapping idly.
 *
 * Score thresholds:
 *   0–18%  → hidden
 *   18–40% → FINDING RHYTHM
 *   40–65% → IN THE ZONE
 *   65%+   → LOCKED IN / IN SYNC
 */
import { useRef, useState, useCallback } from 'react';

// ── Crowd coherence ─────────────────────────────────────────────────────────
const CROWD_BUFFER_SIZE  = 12;
const COHERENT_THRESHOLD = 65;
const CHAOS_CEILING      = 1.0;
const EMA_ALPHA          = 0.30;
const RERENDER_MIN_DELTA = 3;

// ── Personal rhythm ─────────────────────────────────────────────────────────
const PERSONAL_WINDOW    = 8;     // last 8 inter-tap intervals
const PERSONAL_COV_CEIL  = 0.40;  // CoV at or above this → 0% personal sync
const PERSONAL_MIN_TAPS  = 3;     // need at least this many taps to score
const PERSONAL_DECAY_MS  = 5000;  // personal rhythm fades after this idle gap
const G_DEFAULT          = 1.0;   // fallback weight when G-force unavailable

interface TapSample {
  t: number;  // timestamp (ms)
  g: number;  // accelerometer magnitude at time of tap
}

export interface KineticBufferResult {
  /** 0–100: display sync — max(personalRhythm, crowdCoherence) */
  syncPct: number;
  /** 0–100: your own tap rhythm consistency (G-force weighted) */
  personalRhythm: number;
  /** 0–100: crowd coherence from variance buffer */
  crowdCoherence: number;
  /** true when syncPct > 65 */
  isCoherent: boolean;
  /**
   * Call on every tap.
   * gForce: accelerometer magnitude — physical taps weight higher in CoV.
   * Omit on web or when accelerometer unavailable (falls back to equal weighting).
   */
  recordTap: (gForce?: number) => void;
  /** Call after each bolt window — feeds crowd coherence */
  recordVariance: (variance: number) => void;
}

export function useKineticBuffer(): KineticBufferResult {

  // ── Crowd coherence internals ──────────────────────────────────────────────
  const crowdBufRef = useRef<number[]>([]);
  const crowdEmaRef = useRef<number>(0);

  // ── Personal rhythm internals ──────────────────────────────────────────────
  const tapSamplesRef = useRef<TapSample[]>([]);
  const personalRef   = useRef<number>(0);
  const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── React state ────────────────────────────────────────────────────────────
  const [syncPct,        setSyncPct]        = useState(0);
  const [personalRhythm, setPersonalRhythm] = useState(0);
  const [crowdCoherence, setCrowdCoherence] = useState(0);

  const pushSync = useCallback((personal: number, crowd: number) => {
    const next = Math.max(personal, crowd);
    setSyncPct(prev => Math.abs(prev - next) < RERENDER_MIN_DELTA ? prev : next);
  }, []);

  // ── recordTap — G-force weighted CoV ──────────────────────────────────────
  const recordTap = useCallback((gForce?: number) => {
    const now = Date.now();
    const g   = gForce ?? G_DEFAULT;

    // Decay timer — rhythm fades after PERSONAL_DECAY_MS of silence
    if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
    decayTimerRef.current = setTimeout(() => {
      tapSamplesRef.current = [];
      personalRef.current   = 0;
      setPersonalRhythm(0);
      pushSync(0, Math.round(crowdEmaRef.current));
    }, PERSONAL_DECAY_MS);

    tapSamplesRef.current.push({ t: now, g });
    if (tapSamplesRef.current.length > PERSONAL_WINDOW + 1) {
      tapSamplesRef.current = tapSamplesRef.current.slice(-(PERSONAL_WINDOW + 1));
    }

    const samples = tapSamplesRef.current;
    if (samples.length < PERSONAL_MIN_TAPS) return;

    // Build intervals (ms) and their weights (G-force of the tap that ended them)
    // interval[i] = gap between tap i and tap i+1, weight = G-force of tap i+1
    const intervals: number[] = [];
    const weights:   number[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      intervals.push(samples[i + 1].t - samples[i].t);
      weights.push(samples[i + 1].g);
    }

    const wSum     = weights.reduce((a, b) => a + b, 0);
    if (wSum <= 0) return;

    // Weighted mean interval
    const meanW    = intervals.reduce((sum, x, i) => sum + x * weights[i], 0) / wSum;
    if (meanW <= 0) return;

    // Weighted variance
    const varW     = intervals.reduce((sum, x, i) => sum + weights[i] * (x - meanW) ** 2, 0) / wSum;
    const cov      = Math.sqrt(varW) / meanW;

    const personal = Math.round(Math.max(0, (1 - cov / PERSONAL_COV_CEIL) * 100));
    personalRef.current = personal;
    setPersonalRhythm(personal);
    pushSync(personal, Math.round(crowdEmaRef.current));
  }, [pushSync]);

  // ── recordVariance — crowd coherence EMA ──────────────────────────────────
  const recordVariance = useCallback((variance: number) => {
    const buf     = crowdBufRef.current;
    const clamped = Math.min(Math.max(variance, 0), CHAOS_CEILING);

    buf.push(clamped);
    if (buf.length > CROWD_BUFFER_SIZE) buf.shift();

    const avgVariance = buf.reduce((a, b) => a + b, 0) / buf.length;
    const rawSync     = Math.max(0, (1 - avgVariance / CHAOS_CEILING) * 100);
    const newEma      = crowdEmaRef.current * (1 - EMA_ALPHA) + rawSync * EMA_ALPHA;
    crowdEmaRef.current = newEma;

    const crowd = Math.round(newEma);
    setCrowdCoherence(crowd);
    pushSync(personalRef.current, crowd);
  }, [pushSync]);

  return {
    syncPct,
    personalRhythm,
    crowdCoherence,
    isCoherent: syncPct > COHERENT_THRESHOLD,
    recordTap,
    recordVariance,
  };
}
