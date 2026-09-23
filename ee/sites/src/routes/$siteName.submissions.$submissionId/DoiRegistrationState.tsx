import { AlertCircle, Clock, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import { DoiLink } from './DoiLink.js';
import type { RegisterDoiFetcher } from './DoiRow.js';
import type { DoiRegistrationView } from './types.js';
import { SUBMISSION_DETAIL_FORM_ACTIONS } from './SubmissionDetails.utils.js';

type RetryButtonProps = {
  fetcher: RegisterDoiFetcher;
};

function RetryButton({ fetcher }: RetryButtonProps) {
  const submitting = fetcher.state !== 'idle';
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="formAction" value={SUBMISSION_DETAIL_FORM_ACTIONS.registerDoi} />
      <ui.Button type="submit" variant="secondary" size="sm" disabled={submitting}>
        <RefreshCw className={submitting ? 'animate-spin' : undefined} aria-hidden />
        Retry
      </ui.Button>
    </fetcher.Form>
  );
}

type InProgressProps = {
  registration: Extract<DoiRegistrationView, { status: 'SUBMITTING' }>;
};

function InProgress({ registration }: InProgressProps) {
  if (registration.phase === 'waiting') {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2 items-center">
          <ui.Badge variant="primary" size="default" className="gap-1.5">
            <Clock className="w-4 h-4" aria-hidden />
            Waiting for Crossref
          </ui.Badge>
          <span className="text-sm">{registration.doi}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Crossref has received the registration and is checking it. This usually takes a few
          minutes, but can take longer during Crossref maintenance. You can leave this page.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <ui.Badge variant="primary" size="default" className="gap-1.5">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        Registration in progress
      </ui.Badge>
      <p className="text-sm text-muted-foreground">
        {registration.retried ? 'Resubmitting to Crossref…' : 'Sending to Crossref…'}
      </p>
    </div>
  );
}

type RegisteredProps = {
  registration: Extract<DoiRegistrationView, { status: 'REGISTERED' }>;
};

function Registered({ registration }: RegisteredProps) {
  if (!registration.warning) {
    return <DoiLink doi={registration.doi} />;
  }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2 items-center">
        <DoiLink doi={registration.doi} />
        <ui.Badge variant="warning" size="default" className="gap-1.5">
          <TriangleAlert className="w-4 h-4" aria-hidden />
          Registered with a warning
        </ui.Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Crossref registered the DOI but reported: {registration.warning}
      </p>
    </div>
  );
}

type UnsuccessfulProps = {
  registration: Extract<DoiRegistrationView, { status: 'FAILED' }>;
  canRegister: boolean;
  fetcher: RegisterDoiFetcher;
};

function Unsuccessful({ registration, canRegister, fetcher }: UnsuccessfulProps) {
  const { summary, detail } = registration.reason;
  return (
    <div className="space-y-2">
      <ui.Badge variant="destructive" size="default" className="gap-1.5">
        <AlertCircle className="w-4 h-4" aria-hidden />
        Registration unsuccessful
      </ui.Badge>
      <p className="text-sm text-muted-foreground">{summary}</p>
      {detail && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Show Crossref&apos;s message
          </summary>
          <pre className="p-2 mt-1 text-xs whitespace-pre-wrap break-words rounded bg-muted">
            {detail}
          </pre>
        </details>
      )}
      {canRegister && <RetryButton fetcher={fetcher} />}
    </div>
  );
}

type DoiRegistrationStateProps = {
  registration: DoiRegistrationView;
  /** site.doi.register + the DOI feature flag; without it the state shows with no action. */
  canRegister: boolean;
  fetcher: RegisterDoiFetcher;
};

/** The DOI row once a registration exists, one state per step Crossref reports. */
export function DoiRegistrationState({
  registration,
  canRegister,
  fetcher,
}: DoiRegistrationStateProps) {
  switch (registration.status) {
    case 'SUBMITTING':
      return <InProgress registration={registration} />;
    case 'REGISTERED':
      return <Registered registration={registration} />;
    case 'FAILED':
      return (
        <Unsuccessful registration={registration} canRegister={canRegister} fetcher={fetcher} />
      );
  }
}
