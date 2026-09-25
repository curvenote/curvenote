import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useFetcher } from 'react-router';
import type { FetcherWithComponents } from 'react-router';
import { ui } from '@curvenote/scms-core';
import type { RegisterDoiActionData } from './doi.server.js';
import { DoiLink } from './DoiLink.js';
import { DoiRegistrationState } from './DoiRegistrationState.js';
import { doiRowRefreshKey, useDoiRowRefresh } from './doiRowRefresh.js';
import { RegisterDoi } from './RegisterDoi.js';
import type { DoiRowState } from './types.js';

export type RegisterDoiFetcher = FetcherWithComponents<RegisterDoiActionData>;

type DoiRowProps = {
  state: DoiRowState;
  /** site.doi.register + the DOI feature flag. */
  canRegister: boolean;
  resolvesTo: string;
  setupUrl?: string;
  /** Polled while a registration is in progress; reloads the page whenever the row would change. */
  statusUrl: string;
  empty: ReactNode;
};

/**
 * The DOI row. Owns the single register-doi fetcher so the result toast survives the row switching
 * from the dialog to the registration state when the loader revalidates after a successful Register.
 */
export function DoiRow({
  state,
  canRegister,
  resolvesTo,
  setupUrl,
  statusUrl,
  empty,
}: DoiRowProps) {
  useDoiRowRefresh(
    statusUrl,
    doiRowRefreshKey(state.kind === 'registration' ? state.registration : null),
  );
  const fetcher = useFetcher<RegisterDoiActionData>();
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) {
      return;
    }
    if (fetcher.data.error) {
      ui.toastError(fetcher.data.error);
    } else if (fetcher.data.info) {
      ui.toastSuccess(fetcher.data.info);
    }
  }, [fetcher.state, fetcher.data]);

  switch (state.kind) {
    case 'registration':
      return (
        <DoiRegistrationState
          registration={state.registration}
          canRegister={canRegister}
          fetcher={fetcher}
        />
      );
    case 'doi':
      return <DoiLink doi={state.doi} />;
    case 'register':
      return (
        <RegisterDoi
          readiness={state.readiness}
          resolvesTo={resolvesTo}
          setupUrl={setupUrl}
          canRegister={canRegister}
          fetcher={fetcher}
        />
      );
    case 'none':
      return <>{empty}</>;
  }
}
