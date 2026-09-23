import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { RegisterDoiFetcher } from './DoiRow.js';
import type { DoiRegistrationView } from './types.js';

type RetryButtonProps = {
  fetcher: RegisterDoiFetcher;
};

function RetryButton({ fetcher }: RetryButtonProps) {
  const submitting = fetcher.state !== 'idle';
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="formAction" value="register-doi" />
      <ui.Button type="submit" variant="secondary" size="sm" disabled={submitting}>
        <RefreshCw className={submitting ? 'animate-spin' : undefined} aria-hidden />
        Retry
      </ui.Button>
    </fetcher.Form>
  );
}

type DoiRegistrationStateProps = {
  registration: DoiRegistrationView;
  /** site.doi.register + the DOI feature flag; without it the state shows with no action. */
  canRegister: boolean;
  fetcher: RegisterDoiFetcher;
};

/** The DOI row once a registration exists: in progress, resubmitting, unsuccessful or registered. */
export function DoiRegistrationState({
  registration,
  canRegister,
  fetcher,
}: DoiRegistrationStateProps) {
  if (registration.status === 'REGISTERED') {
    // Once REGISTERED, the row shows the work's DOI in place of a status badge.
    return <span className="text-sm">{registration.doi}</span>;
  }
  if (registration.status === 'SUBMITTING') {
    return (
      <div className="space-y-1">
        <ui.Badge variant="primary" size="default" className="gap-1.5">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Registration in progress
        </ui.Badge>
        <p className="text-sm text-muted-foreground">
          {registration.retried
            ? 'Resubmitting the registration to Crossref…'
            : 'Submitted to Crossref. This may take a few minutes. You can leave this page.'}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <ui.Badge variant="destructive" size="default" className="gap-1.5">
        <AlertCircle className="w-4 h-4" aria-hidden />
        Registration unsuccessful
      </ui.Badge>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t submit the registration to Crossref. No DOI was registered.
      </p>
      {canRegister && <RetryButton fetcher={fetcher} />}
    </div>
  );
}
