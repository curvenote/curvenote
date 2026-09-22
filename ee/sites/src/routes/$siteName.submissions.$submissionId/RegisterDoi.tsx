import { Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { Await } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import type { DoiReadiness } from '../../backend/deposit/readiness.server.js';
import type { DepositIssue } from '../../backend/deposit/types.js';
import { RegisterDoiDialog } from './RegisterDoiDialog.js';

type IssueCopy = {
  title: string;
  hint: string;
};

const PUBLISHED_CONTENT_MISSING: IssueCopy = {
  title: 'Published content not found',
  hint: 'Publish the submission again to register a DOI.',
};

/** Row copy per blocking issue code; the mapper's own messages stay for logs. */
const ISSUE_COPY: Record<string, IssueCopy> = {
  missing_date: {
    title: 'Publication date required',
    hint: 'Add a publication date to register a DOI.',
  },
  missing_title: {
    title: 'Title required',
    hint: 'Add a title to the article to register a DOI.',
  },
  site_not_active: {
    title: 'DOIs not set up',
    hint: 'Set up DOIs for this site to register a DOI.',
  },
  no_cdn: PUBLISHED_CONTENT_MISSING,
  no_page: PUBLISHED_CONTENT_MISSING,
  not_found: PUBLISHED_CONTENT_MISSING,
};

const NOT_PUBLISHED: IssueCopy = {
  title: 'Not published',
  hint: 'Publish this submission to register a DOI.',
};

function copyForIssue(issue: DepositIssue): IssueCopy {
  return ISSUE_COPY[issue.code] ?? { title: issue.message, hint: '' };
}

/** Site setup comes first: until it's done, fixing the submission doesn't unblock anything. */
const ISSUE_PRIORITY = ['site_not_active', 'missing_title', 'missing_date'];

function issuePriority(issue: DepositIssue): number {
  const index = ISSUE_PRIORITY.indexOf(issue.code);
  return index === -1 ? ISSUE_PRIORITY.length : index;
}

type BlockerProps = {
  copy: IssueCopy;
  /** Rendered after the title, on the same line. */
  aside?: ReactNode;
};

function Blocker({ copy, aside }: BlockerProps) {
  return (
    <div>
      <div className="flex gap-2 items-center">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
        <p className="text-sm">{copy.title}</p>
        {aside}
      </div>
      {copy.hint && <p className="mt-1 text-sm text-muted-foreground">{copy.hint}</p>}
    </div>
  );
}

type BlockersProps = {
  issues: DepositIssue[];
};

/** The top-priority blocker, with the rest behind a "+N more" toggle beside its title. */
function Blockers({ issues }: BlockersProps) {
  const [expanded, setExpanded] = useState(false);
  const [first, ...rest] = [...issues].sort((a, b) => issuePriority(a) - issuePriority(b));
  if (!first) {
    return null;
  }
  const toggle = rest.length > 0 && (
    <button
      type="button"
      className="text-sm text-muted-foreground hover:underline"
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
    >
      {expanded ? 'Show less' : `+${rest.length} more ${rest.length === 1 ? 'issue' : 'issues'}`}
    </button>
  );
  return (
    <div className="space-y-3">
      <Blocker copy={copyForIssue(first)} aside={toggle} />
      {expanded &&
        rest.map((issue, index) => (
          <Blocker key={`${issue.code}-${index}`} copy={copyForIssue(issue)} />
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
};

function RegisterDoiState({ readiness, resolvesTo }: RegisterDoiStateProps) {
  switch (readiness.kind) {
    case 'ready':
      return (
        <RegisterDoiDialog
          prefix={readiness.prefix}
          summary={readiness.summary}
          warnings={readiness.warnings}
          resolvesTo={resolvesTo}
        />
      );
    case 'blocked':
      return <Blockers issues={readiness.issues} />;
    case 'not_published':
      return <Blocker copy={NOT_PUBLISHED} />;
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
};

/** The DOI row when the work has no DOI yet. The check reads the CDN, so it streams in. */
export function RegisterDoi({ readiness, resolvesTo }: RegisterDoiProps) {
  const unavailable = (
    <Note>Could not check the DOI requirements. Reload the page to try again.</Note>
  );
  return (
    <Suspense fallback={<Note>Checking the DOI requirements…</Note>}>
      {/* loadDoiReadiness never rejects; this covers the stream being cut off. */}
      <Await resolve={readiness} errorElement={unavailable}>
        {(resolved: DoiReadiness) => (
          <RegisterDoiState readiness={resolved} resolvesTo={resolvesTo} />
        )}
      </Await>
    </Suspense>
  );
}
