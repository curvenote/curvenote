import { useEffect, useRef, useState } from 'react';
import type { VersionTimelineResponse } from '../types/versionTimeline.js';

const timelineCache = new Map<string, unknown[]>();
const inFlight = new Map<string, Promise<unknown[]>>();

export async function loadVersionTimeline<T extends { id: string }>(
  versionsUrl: string,
): Promise<T[]> {
  const existing = inFlight.get(versionsUrl);
  if (existing) {
    return existing as Promise<T[]>;
  }

  const promise = (async () => {
    const response = await fetch(versionsUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to load versions (${response.status})`);
    }

    const body = (await response.json()) as VersionTimelineResponse<T>;
    const versions = body.versions;
    if (!Array.isArray(versions)) {
      throw new Error('Invalid versions response');
    }

    timelineCache.set(versionsUrl, versions);
    return versions;
  })();

  inFlight.set(versionsUrl, promise);

  try {
    return (await promise) as T[];
  } finally {
    inFlight.delete(versionsUrl);
  }
}

export function getCachedVersionTimeline<T extends { id: string }>(
  versionsUrl: string,
): T[] | undefined {
  return timelineCache.get(versionsUrl) as T[] | undefined;
}

export function useVersionTimeline<T extends { id: string }>(
  versionsUrl: string,
  { open }: { open: boolean },
) {
  const [data, setData] = useState<T[] | undefined>(() => getCachedVersionTimeline<T>(versionsUrl));
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
        .then((versions) => {
          if (!mountedRef.current) return;
          setData(versions);
        })
        .catch(() => {
          // Keep showing stale cache on background revalidate failure.
        });
      return;
    }

    setLoading(true);
    setError(undefined);

    void loadVersionTimeline<T>(versionsUrl)
      .then((versions) => {
        if (!mountedRef.current) return;
        setData(versions);
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
