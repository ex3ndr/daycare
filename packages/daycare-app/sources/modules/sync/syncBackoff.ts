const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_JITTER = 0.2;

/**
 * Computes the next backoff delay with jitter.
 * Returns [delay, nextBackoffMs] where delay includes random jitter.
 *
 * Expects: currentBackoffMs >= BACKOFF_INITIAL_MS.
 */
export function syncBackoffCompute(currentBackoffMs: number): [number, number] {
    const jitter = currentBackoffMs * BACKOFF_JITTER * Math.random();
    const delay = currentBackoffMs + jitter;
    const nextBackoffMs = Math.min(currentBackoffMs * 2, BACKOFF_MAX_MS);
    return [delay, nextBackoffMs];
}

export { BACKOFF_INITIAL_MS, BACKOFF_MAX_MS };
