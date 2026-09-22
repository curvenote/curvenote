import { ui } from '@curvenote/scms-core';
import type { DepositIssue } from '../../backend/deposit/types.js';
import type { SubmissionDoiPageState } from './loader.server.js';
import { isReady, sortIssues } from './readiness.js';

type IssueRowProps = {
  issue: DepositIssue;
};

function IssueRow({ issue }: IssueRowProps) {
  const blocking = issue.severity === 'blocking';
  return (
    <li className="flex gap-3 items-start text-sm">
      <ui.Badge
        variant={blocking ? 'destructive' : 'warning'}
        size="xs"
        className="mt-0.5 shrink-0"
      >
        {blocking ? 'Blocking' : 'Warning'}
      </ui.Badge>
      <span>
        {issue.message}
        {issue.path && <code className="ml-2 text-xs text-muted-foreground">{issue.path}</code>}
      </span>
    </li>
  );
}

type DoiReadinessCardProps = {
  state: SubmissionDoiPageState;
};

export function DoiReadinessCard({ state }: DoiReadinessCardProps) {
  if (state.kind === 'not_published') {
    return (
      <ui.Card className="px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2>Deposit readiness</h2>
          <ui.Badge variant="neutral">Not published</ui.Badge>
        </div>
        <p className="text-sm font-light">
          A DOI is registered for the published version. Publish this submission to see what the
          deposit would contain.
        </p>
      </ui.Card>
    );
  }
  if (state.kind !== 'assembled') {
    return null;
  }
  const ready = isReady(state.issues);
  const issues = sortIssues(state.issues);
  return (
    <ui.Card className="px-6 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2>Deposit readiness</h2>
        <ui.Badge variant={ready ? 'success' : 'destructive'}>
          {ready ? 'Ready for deposit' : 'Not ready'}
        </ui.Badge>
      </div>
      <p className="text-sm font-light">
        {ready ? (
          <>
            Everything Crossref requires is present.
            {issues.length > 0 && ' Warnings below are sent as-is.'}
          </>
        ) : (
          'Fix the blocking issues before this submission can be registered.'
        )}
      </p>
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing missing.</p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue, index) => (
            <IssueRow key={`${issue.code}-${index}`} issue={issue} />
          ))}
        </ul>
      )}
    </ui.Card>
  );
}
