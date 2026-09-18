import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';

type TagChangeErrorToastProps = {
  fetcherKey: string;
};

/**
 * Renders nothing. `useFetchers()` does not expose fetcher data, so each tag
 * fetcher is observed by key to toast its action error. The effect is a side
 * effect (a toast), not derived state.
 *
 * It keys on the `data` object rather than waiting for an `idle` state: a failed
 * change still revalidates (see the route's `shouldRevalidate`), and the router
 * drops the fetcher when that revalidation lands, so the error is only ever
 * observed while the fetcher is still `loading`. Each submit produces a new
 * `data` object, so a repeated failure toasts again.
 */
export function TagChangeErrorToast({ fetcherKey }: TagChangeErrorToastProps) {
  const fetcher = useFetcher<{ error?: string }>({ key: fetcherKey });
  const { data } = fetcher;

  useEffect(() => {
    if (data?.error) {
      ui.toastError(data.error);
    }
  }, [data]);

  return null;
}
