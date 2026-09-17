import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { ui } from '@curvenote/scms-core';

type TagChangeErrorToastProps = {
  fetcherKey: string;
};

/**
 * Renders nothing. `useFetchers()` does not expose fetcher data, so each tag
 * fetcher is observed by key to toast its action error. The effect is a side
 * effect (a toast), not derived state. `error` is undefined while the fetcher
 * is busy, so a retry that fails with the same message toasts again.
 */
export function TagChangeErrorToast({ fetcherKey }: TagChangeErrorToastProps) {
  const fetcher = useFetcher<{ error?: string }>({ key: fetcherKey });
  const error = fetcher.state === 'idle' ? fetcher.data?.error : undefined;

  useEffect(() => {
    if (error) {
      ui.toastError(error);
    }
  }, [error]);

  return null;
}
