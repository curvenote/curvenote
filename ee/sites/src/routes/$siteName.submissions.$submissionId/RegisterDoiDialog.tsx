import type { ReactNode } from 'react';
import { Link2 } from 'lucide-react';
import { formatDate, ui } from '@curvenote/scms-core';
import type { DepositIssue, DepositSummary } from '../../backend/deposit/types.js';

type SummaryRowProps = {
  label: string;
  children: ReactNode;
};

function SummaryRow({ label, children }: SummaryRowProps) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

type RegisterDoiDialogProps = {
  prefix: string;
  summary: DepositSummary;
  warnings: DepositIssue[];
};

/** What Crossref would receive, read-only. Registering itself arrives with CN-2581. */
export function RegisterDoiDialog({ prefix, summary, warnings }: RegisterDoiDialogProps) {
  return (
    <ui.Dialog>
      <ui.DialogTrigger asChild>
        <ui.Button variant="secondary" size="sm">
          <Link2 aria-hidden />
          Register DOI
        </ui.Button>
      </ui.DialogTrigger>
      <ui.DialogContent variant="wide">
        <ui.DialogHeader>
          <ui.DialogTitle>Register DOI</ui.DialogTitle>
          <ui.DialogDescription>
            Crossref receives these details from the published version. The DOI is assigned under{' '}
            <code>{prefix}</code> when you register.
          </ui.DialogDescription>
        </ui.DialogHeader>
        <dl className="space-y-2">
          <SummaryRow label="Title">{summary.title}</SummaryRow>
          {summary.subtitle && <SummaryRow label="Subtitle">{summary.subtitle}</SummaryRow>}
          <SummaryRow label="Posted date">{formatDate(summary.date)}</SummaryRow>
          <SummaryRow label="Authors">
            {summary.authors.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <ul>
                {summary.authors.map((author, index) => (
                  <li key={`${author.name}-${index}`}>
                    {author.name}
                    {author.orcid && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ORCID {author.orcid}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SummaryRow>
          <SummaryRow label="License">
            {summary.license ?? <span className="text-muted-foreground">None</span>}
          </SummaryRow>
          <SummaryRow label="Abstract">{summary.hasAbstract ? 'Included' : 'Not found'}</SummaryRow>
          <SummaryRow label="References">{summary.citationCount} with a DOI</SummaryRow>
        </dl>
        {warnings.length > 0 && (
          <ul className="space-y-2">
            {warnings.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="flex gap-3 items-start text-sm">
                <ui.Badge variant="warning" size="xs" className="mt-0.5 shrink-0">
                  Warning
                </ui.Badge>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
        <ui.DialogFooter>
          <ui.DialogClose asChild>
            <ui.Button variant="ghost">Cancel</ui.Button>
          </ui.DialogClose>
          {/* Disabled until the register action lands (CN-2581). */}
          <ui.Button disabled>Register</ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
