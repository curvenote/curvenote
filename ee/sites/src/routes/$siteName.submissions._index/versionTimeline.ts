import { useEffect, useRef, useState } from 'react';
import type { VersionTimelineEntry } from '../$siteName.submissions.$submissionId.versions/db.server.js';

const timelineCache = new Map<string, VersionTimelineEntry[]>();
const inFlight = new Map<string, Promise<VersionTimelineEntry[]>>();

function cacheKey(siteName: string, submissionId: string) {
  return `${siteName}:${submissionId}`;
}

function versionsUrl(siteName: string, submissionId: string) {
  return `/app/sites/${encodeURIComponent(siteName)}/submissions/${encodeURIComponent(submissionId)}/versions`;
}

export async function loadSubmissionVersionTimeline(
  siteName: string,
  submissionId: string,
): Promise<VersionTimelineEntry[]> {
  const key = cacheKey(siteName, submissionId);
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const response = await fetch(versionsUrl(siteName, submissionId), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to load versions (${response.status})`);
    }

    const body = (await response.json()) as { versions?: VersionTimelineEntry[] };
    const versions = body.versions;
    if (!Array.isArray(versions)) {
      throw new Error('Invalid versions response');
    }

    timelineCache.set(key, versions);
    return versions;
  })();

  inFlight.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export function getCachedSubmissionVersionTimeline(
  siteName: string,
  submissionId: string,
): VersionTimelineEntry[] | undefined {
  return timelineCache.get(cacheKey(siteName, submissionId));
}

export function useSubmissionVersionTimeline(
  siteName: string,
  submissionId: string,
  { open }: { open: boolean },
) {
  const [data, setData] = useState<VersionTimelineEntry[] | undefined>(() =>
    getCachedSubmissionVersionTimeline(siteName, submissionId),
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

    const cached = getCachedSubmissionVersionTimeline(siteName, submissionId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(undefined);

      void loadSubmissionVersionTimeline(siteName, submissionId)
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

    void loadSubmissionVersionTimeline(siteName, submissionId)
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
  }, [open, siteName, submissionId]);

  return { data, loading, error };
}
