import { useCallback } from 'react';
import { useRevalidator } from 'react-router';
import { usePolling } from '@curvenote/scms-core';
import type { DoiRegistrationView } from './types.js';

/** Changes whenever the DOI row would show something else; null when nothing can change on its own. */
export function doiRowRefreshKey(view: DoiRegistrationView | null): string | null {
  return view?.status === 'SUBMITTING' ? view.phase : null;
}

export type DoiStatusResponse = { key: string | null };

const INTERVAL_MS = 10_000;
// Rides out a network blip or a brief outage without freezing the row; a persistent refusal
// (e.g. a lost session answered with a redirect on every attempt) still stops within ~5 minutes.
const STATUS_CHECK_RETRIES = 30;

/**
 * While the registration is in progress, reads the row's key every 10 s and reloads the page once
 * it changes. The page loader is too heavy (CDN reads, an analytics event) to poll for the hours
 * Crossref can take.
 */
export function useDoiRowRefresh(statusUrl: string, key: string | null) {
  const revalidator = useRevalidator();
  const revalidate = revalidator.revalidate;
  const shouldStop = useCallback((data: DoiStatusResponse) => data.key !== key, [key]);
  const onComplete = useCallback(() => {
    void revalidate();
  }, [revalidate]);
  usePolling<DoiStatusResponse>({
    url: statusUrl,
    interval: INTERVAL_MS,
    enabled: key !== null,
    numRetries: STATUS_CHECK_RETRIES,
    shouldStop,
    onComplete,
  });
}
