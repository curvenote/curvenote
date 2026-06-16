import { useEffect, useRef, useState } from 'react';
import type { TrimmedVersionTimeline, VersionTimelineResponse } from '../types/versionTimeline.js';

const timelineCache = new Map<string, TrimmedVersionTimeline<{ id: string }>>();
const inFlight = new Map<string, Promise<TrimmedVersionTimeline<{ id: string }>>>();

export async function loadVersionTimeline<T extends { id: string }>(
  versionsUrl: string,
): Promise<TrimmedVersionTimeline<T>> {
  const existing = inFlight.get(versionsUrl);
  if (existing) {
    return existing as Promise<TrimmedVersionTimeline<T>>;
  }

  const promise = (async () => {
    const response = await fetch(versionsUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to load versions (${response.status})`);
    }

    const body = (await response.json()) as VersionTimelineResponse<T>;
    if (!Array.isArray(body.items) || typeof body.total !== 'number') {
      throw new Error('Invalid versions response');
    }

    const timeline: TrimmedVersionTimeline<T> = {
      total: body.total,
      hidden: body.hidden ?? 0,
      seeAllHref: body.seeAllHref ?? '',
      items: body.items,
    };

    timelineCache.set(versionsUrl, timeline as TrimmedVersionTimeline<{ id: string }>);
    return timeline;
  })();

  inFlight.set(versionsUrl, promise);

  try {
    return (await promise) as TrimmedVersionTimeline<T>;
  } finally {
    inFlight.delete(versionsUrl);
  }
}

export function getCachedVersionTimeline<T extends { id: string }>(
  versionsUrl: string,
): TrimmedVersionTimeline<T> | undefined {
  return timelineCache.get(versionsUrl) as TrimmedVersionTimeline<T> | undefined;
}

export function useVersionTimeline<T extends { id: string }>(
  versionsUrl: string,
  { open }: { open: boolean },
) {
  const [data, setData] = useState<TrimmedVersionTimeline<T> | undefined>(() =>
    getCachedVersionTimeline<T>(versionsUrl),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const cached = getCachedVersionTimeline<T>(versionsUrl);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(undefined);

      void loadVersionTimeline<T>(versionsUrl)
        .then((timeline) => {
          if (!mountedRef.current) return;
          setData(timeline);
        })
        .catch(() => {
          // Keep showing stale cache on background revalidate failure.
        });
      return;
    }

    setLoading(true);
    setError(undefined);

    void loadVersionTimeline<T>(versionsUrl)
      .then((timeline) => {
        if (!mountedRef.current) return;
        setData(timeline);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Could not load versions');
        setLoading(false);
      });
  }, [open, versionsUrl]);

  return { data, loading, error };
}
