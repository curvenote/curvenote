import { useEffect, useRef, useState } from 'react';
import type { InboxQueueStats } from './db.queue-stats.server.js';

const statsCache = new Map<string, InboxQueueStats>();
const inFlight = new Map<string, Promise<InboxQueueStats>>();

function cacheKey(siteName: string) {
  return siteName;
}

function queueStatsUrl(siteName: string) {
  return `/app/sites/${encodeURIComponent(siteName)}/inbox/queue-stats`;
}

export async function loadInboxQueueStats(siteName: string): Promise<InboxQueueStats> {
  const key = cacheKey(siteName);
  const cached = statsCache.get(key);
  if (cached) {
    return cached;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const response = await fetch(queueStatsUrl(siteName), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to load queue stats (${response.status})`);
    }

    const body = (await response.json()) as { stats?: InboxQueueStats };
    const stats = body.stats;
    if (!stats || typeof stats.byQueue !== 'object') {
      throw new Error('Invalid queue stats response');
    }

    statsCache.set(key, stats);
    return stats;
  })();

  inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export function getCachedInboxQueueStats(siteName: string): InboxQueueStats | undefined {
  return statsCache.get(cacheKey(siteName));
}

/** Lazy-loads per-queue counts and max time-in-queue for the inbox tile grid. */
export function useInboxQueueStats(siteName: string, { enabled }: { enabled: boolean }) {
  const [data, setData] = useState<InboxQueueStats | undefined>(() =>
    getCachedInboxQueueStats(siteName),
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
    if (!enabled) return;

    setData(getCachedInboxQueueStats(siteName));
    setError(undefined);

    const cached = getCachedInboxQueueStats(siteName);
    if (cached) {
      setPending(false);
      void loadInboxQueueStats(siteName)
        .then((stats) => {
          if (!mountedRef.current) return;
          setData(stats);
        })
        .catch(() => {
          // Keep stale cache on background revalidate failure.
        });
      return;
    }

    setPending(true);
    void loadInboxQueueStats(siteName)
      .then((stats) => {
        if (!mountedRef.current) return;
        setData(stats);
        setPending(false);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Could not load queue stats');
        setPending(false);
      });
  }, [siteName, enabled]);

  return {
    data,
    loading: enabled && pending && !data,
    error,
  };
}
