import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useFetcher } from 'react-router';
import type { FetcherWithComponents } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { buildUrl } from 'doi-utils';
import { ui } from '@curvenote/scms-core';
import type { DoiReadiness } from '../../backend/deposit/readiness.server.js';
import type { RegisterDoiActionData } from './doi.server.js';
import { DoiRegistrationState } from './DoiRegistrationState.js';
import { RegisterDoi } from './RegisterDoi.js';
import type { DoiRegistrationView } from './types.js';

export type RegisterDoiFetcher = FetcherWithComponents<RegisterDoiActionData>;

type DoiRowProps = {
  doi?: string;
  registration: DoiRegistrationView | null;
  readiness: Promise<DoiReadiness> | null;
  /** site.doi.register + the DOI feature flag. */
  canRegister: boolean;
  resolvesTo: string;
  setupUrl?: string;
  empty: ReactNode;
};

/**
 * The DOI row. Owns the single register-doi fetcher so the result toast survives the row switching
 * from the dialog to the registration state when the loader revalidates after a successful Register.
 */
export function DoiRow({
  doi,
  registration,
  readiness,
  canRegister,
  resolvesTo,
  setupUrl,
  empty,
}: DoiRowProps) {
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

  if (doi) {
    return (
      <a
        href={buildUrl(doi)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex gap-1 items-center text-sm break-all text-primary hover:underline"
      >
        {doi}
        <ExternalLink className="inline-block w-4 h-4 shrink-0" aria-hidden />
      </a>
    );
  }
  if (registration) {
    return (
      <DoiRegistrationState
        registration={registration}
        canRegister={canRegister}
        fetcher={fetcher}
      />
    );
  }
  if (readiness) {
    return (
      <RegisterDoi
        readiness={readiness}
        resolvesTo={resolvesTo}
        setupUrl={setupUrl}
        canRegister={canRegister}
        fetcher={fetcher}
      />
    );
  }
  return <>{empty}</>;
}
