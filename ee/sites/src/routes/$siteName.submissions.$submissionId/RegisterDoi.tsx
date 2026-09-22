import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Await } from 'react-router';
import { Link2 } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { DoiReadiness } from '../../backend/deposit/readiness.server.js';
import { RegisterDoiDialog } from './RegisterDoiDialog.js';

type NoteProps = {
  children: ReactNode;
};

function Note({ children }: NoteProps) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
}

type RegisterDoiStateProps = {
  readiness: DoiReadiness;
};

function RegisterDoiState({ readiness }: RegisterDoiStateProps) {
  switch (readiness.kind) {
    case 'ready':
      return (
        <RegisterDoiDialog
          prefix={readiness.prefix}
          summary={readiness.summary}
          warnings={readiness.warnings}
        />
      );
    case 'blocked':
      return (
        <div className="space-y-2">
          <ui.Button variant="secondary" size="sm" disabled>
            <Link2 aria-hidden />
            Register DOI
          </ui.Button>
          <div className="text-sm">
            <p>Missing before a DOI can be registered:</p>
            <ul className="pl-5 list-disc text-muted-foreground">
              {readiness.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    case 'not_published':
      return <Note>Publish this submission to register a DOI.</Note>;
    case 'not_configured':
      return <Note>DOI registration is not configured on this deployment.</Note>;
    case 'unavailable':
      return <Note>Could not check the DOI requirements. Reload the page to try again.</Note>;
  }
}

type RegisterDoiProps = {
  readiness: Promise<DoiReadiness>;
};

/** The DOI row when the work has no DOI yet. The check reads the CDN, so it streams in. */
export function RegisterDoi({ readiness }: RegisterDoiProps) {
  const unavailable = (
    <Note>Could not check the DOI requirements. Reload the page to try again.</Note>
  );
  return (
    <Suspense fallback={<Note>Checking the DOI requirements…</Note>}>
      {/* loadDoiReadiness never rejects; this covers the stream being cut off. */}
      <Await resolve={readiness} errorElement={unavailable}>
        {(resolved: DoiReadiness) => <RegisterDoiState readiness={resolved} />}
      </Await>
    </Suspense>
  );
}
