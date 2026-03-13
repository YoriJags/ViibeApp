/**
 * useRetryFetch
 *
 * POST with 3-tier exponential backoff for Lagos network conditions.
 *
 * Retry schedule:
 *   Attempt 1 — immediate
 *   Attempt 2 — 1.5s delay  (covers brief network dropout)
 *   Attempt 3 — 4.5s delay  (covers longer instability)
 *   After 3 failures → onFailure() callback
 *
 * Usage:
 *   const { post, pending } = useRetryFetch();
 *   const data = await post(url, options, { onOptimistic, onSuccess, onFailure });
 */
import { useCallback, useRef, useState } from 'react';

const RETRY_DELAYS = [0, 1500, 4500]; // ms

interface RetryOptions<T> {
  onOptimistic?: () => void;  // called immediately before first attempt
  onSuccess?: (data: T) => void;
  onFailure?: (status: number | null) => void;
}

export function useRetryFetch() {
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const post = useCallback(async <T>(
    url: string,
    fetchOptions: RequestInit,
    callbacks: RetryOptions<T> = {},
  ): Promise<T | null> => {
    const { onOptimistic, onSuccess, onFailure } = callbacks;

    // Fire optimistic update immediately
    onOptimistic?.();
    setPending(true);

    // Cancel any in-flight previous attempt
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let lastStatus: number | null = null;

    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      // Exponential delay (skip on first attempt)
      if (RETRY_DELAYS[attempt] > 0) {
        await new Promise(res => setTimeout(res, RETRY_DELAYS[attempt]));
      }
      if (controller.signal.aborted) break;

      try {
        const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
        lastStatus = res.status;

        if (res.ok) {
          const data: T = await res.json();
          onSuccess?.(data);
          setPending(false);
          return data;
        }

        // Non-retryable: rate limit (429), auth (401/403), not found (404)
        if ([401, 403, 404, 429].includes(res.status)) {
          onFailure?.(res.status);
          setPending(false);
          return null;
        }

        // 5xx or network error → retry
      } catch (err: any) {
        if (err?.name === 'AbortError') break;
        // Network failure → retry
      }
    }

    // All attempts exhausted
    onFailure?.(lastStatus);
    setPending(false);
    return null;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPending(false);
  }, []);

  return { post, pending, cancel };
}
