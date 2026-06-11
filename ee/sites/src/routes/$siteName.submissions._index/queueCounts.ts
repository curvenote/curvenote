import { useEffect, useRef, useState } from 'react';
import type { QueueSubmissionCounts } from './db.server.js';

const countsCache = new Map<string, QueueSubmissionCounts>();
const inFlight = new Map<string, Promise<QueueSubmissionCounts>>();

function cacheKey(siteName: string) {
  return siteName;
}

function queueCountsUrl(siteName: string) {
  return `/app/sites/${encodeURIComponent(siteName)}/submissions/queue-counts`;
}

export async function loadQueueCounts(siteName: string): Promise<QueueSubmissionCounts> {
  const key = cacheKey(siteName);
  const cached = countsCache.get(key);
  if (cached) {
    return cached;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const response = await fetch(queueCountsUrl(siteName), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to load queue counts (${response.status})`);
    }

    const body = (await response.json()) as { counts?: QueueSubmissionCounts };
    const counts = body.counts;
    if (!counts || typeof counts.byQueue !== 'object') {
      throw new Error('Invalid queue counts response');
    }

    countsCache.set(key, counts);
    return counts;
  })();

  inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export function getCachedQueueCounts(siteName: string): QueueSubmissionCounts | undefined {
  return countsCache.get(cacheKey(siteName));
}

/**
 * Prefetches queue totals in the background; shows loading while the popover is
 * open and counts are not yet available.
 */
export function useQueueCounts(siteName: string, { open }: { open: boolean }) {
  const [data, setData] = useState<QueueSubmissionCounts | undefined>(() =>
    getCachedQueueCounts(siteName),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setData(getCachedQueueCounts(siteName));
    setError(undefined);

    const cached = getCachedQueueCounts(siteName);
    if (cached) {
      setPending(false);
      void loadQueueCounts(siteName)
        .then((counts) => {
          if (!mountedRef.current) return;
          setData(counts);
        })
        .catch(() => {
          // Keep stale cache on background revalidate failure.
        });
      return;
    }

    setPending(true);
    void loadQueueCounts(siteName)
      .then((counts) => {
        if (!mountedRef.current) return;
        setData(counts);
        setPending(false);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Could not load queue counts');
        setPending(false);
      });
  }, [siteName]);

  return {
    data,
    loading: open && pending && !data,
    error,
  };
}
