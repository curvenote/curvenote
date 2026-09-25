import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Await, Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import type { DoiReadiness } from '../../backend/deposit/readiness.server.js';
import type { DepositIssue } from '../../backend/deposit/types.js';
import type { RegisterDoiFetcher } from './DoiRow.js';
import { RegisterDoiDialog } from './RegisterDoiDialog.js';
import { describeDoiBlockers } from './RegisterDoi.utils.js';

type BlockerProps = {
  children: ReactNode;
};

function Blocker({ children }: BlockerProps) {
  return (
    <div className="flex gap-2 items-center">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
      <p className="text-sm">{children}</p>
    </div>
  );
}

type BlockersProps = {
  issues: DepositIssue[];
  /** DOI Registration page; only for people who can configure it. */
  setupUrl?: string;
};

function Blockers({ issues, setupUrl }: BlockersProps) {
  const blockers = describeDoiBlockers(issues);
  if (blockers.kind === 'setup') {
    return (
      <Blocker>
        {blockers.sentence}
        {setupUrl && (
          <>
            {' '}
            <Link to={setupUrl} className="text-primary hover:underline">
              {blockers.action}
            </Link>
          </>
        )}
      </Blocker>
    );
  }
  return (
    <div className="space-y-2">
      {blockers.sentences.map((sentence) => (
        <Blocker key={sentence}>{sentence}</Blocker>
      ))}
    </div>
  );
}

type NoteProps = {
  children: ReactNode;
};

function Note({ children }: NoteProps) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}

type RegisterDoiStateProps = {
  readiness: DoiReadiness;
  resolvesTo: string;
  setupUrl?: string;
  canRegister: boolean;
  fetcher: RegisterDoiFetcher;
};

function RegisterDoiState({
  readiness,
  resolvesTo,
  setupUrl,
  canRegister,
  fetcher,
}: RegisterDoiStateProps) {
  switch (readiness.kind) {
    case 'ready':
      if (!canRegister) {
        return <Note>Ready to register. A site admin can register the DOI.</Note>;
      }
      return (
        <RegisterDoiDialog
          prefix={readiness.prefix}
          summary={readiness.summary}
          warnings={readiness.warnings}
          resolvesTo={resolvesTo}
          fetcher={fetcher}
        />
      );
    case 'blocked':
      return <Blockers issues={readiness.issues} setupUrl={setupUrl} />;
    case 'not_published':
      return <Blocker>Publish this submission to register a DOI.</Blocker>;
    case 'not_configured':
      return <Note>DOI registration is not configured on this deployment.</Note>;
    case 'unavailable':
      return <Note>Could not check the DOI requirements. Reload the page to try again.</Note>;
  }
}

type RegisterDoiProps = {
  readiness: Promise<DoiReadiness>;
  /** Public URL of the published work, where the DOI will point. */
  resolvesTo: string;
  /** DOI Registration page, linked when the site isn't set up; omit when the user can't open it. */
  setupUrl?: string;
  /** site.doi.register + the DOI feature flag; without it a ready work shows a note, no button. */
  canRegister: boolean;
  fetcher: RegisterDoiFetcher;
};

/** The DOI row when the work has no DOI yet. The check reads the CDN, so it streams in. */
export function RegisterDoi({
  readiness,
  resolvesTo,
  setupUrl,
  canRegister,
  fetcher,
}: RegisterDoiProps) {
  const unavailable = (
    <Note>Could not check the DOI requirements. Reload the page to try again.</Note>
  );
  return (
    <Suspense fallback={<Note>Checking the DOI requirements…</Note>}>
      {/* loadDoiReadiness never rejects; this covers the stream being cut off. */}
      <Await resolve={readiness} errorElement={unavailable}>
        {(resolved: DoiReadiness) => (
          <RegisterDoiState
            readiness={resolved}
            resolvesTo={resolvesTo}
            setupUrl={setupUrl}
            canRegister={canRegister}
            fetcher={fetcher}
          />
        )}
      </Await>
    </Suspense>
  );
}
