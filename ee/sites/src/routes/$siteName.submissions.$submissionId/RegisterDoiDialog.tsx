import type { ReactNode } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { DepositIssue, DepositSummary } from '../../backend/deposit/types.js';
import { formatPublicationDate } from '../../publicationDateCalendar.js';
import type { RegisterDoiFetcher } from './DoiRow.js';

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

type DetailRowProps = {
  label: string;
  children: ReactNode;
};

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

type ReadyAlertProps = {
  warnings: DepositIssue[];
};

/** The design has no slot for warnings, so they ride on the ready callout. */
function ReadyAlert({ warnings }: ReadyAlertProps) {
  if (warnings.length === 0) {
    return (
      <ui.SimpleAlert
        type="success"
        size="compact"
        message={
          <>
            <strong>Ready to register</strong>
            <br />
            All required information is available.
          </>
        }
      />
    );
  }
  return (
    <ui.SimpleAlert
      type="warning"
      size="compact"
      message={
        <>
          <strong>Ready to register</strong>
          <br />
          {/* SimpleAlert wraps the message in a <span>, so no block elements here. */}
          {warnings.map((issue, index) => (
            <span key={`${issue.code}-${index}`} className="block">
              {issue.message}
            </span>
          ))}
        </>
      }
    />
  );
}

const authorList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

type RegisterDoiDialogProps = {
  prefix: string;
  summary: DepositSummary;
  warnings: DepositIssue[];
  resolvesTo: string;
  fetcher: RegisterDoiFetcher;
};

/**
 * What Crossref will receive, and the Register action. Closes by unmounting once the row shows
 * the registration.
 */
export function RegisterDoiDialog({
  prefix,
  summary,
  warnings,
  resolvesTo,
  fetcher,
}: RegisterDoiDialogProps) {
  const submitting = fetcher.state !== 'idle';
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
            Review the registration details before registering a DOI for this Work.
          </ui.DialogDescription>
        </ui.DialogHeader>
        <ReadyAlert warnings={warnings} />
        <Section title="Registration details">
          <dl className="space-y-2">
            <DetailRow label="Work">{summary.title}</DetailRow>
            <DetailRow label="Authors">
              {summary.authors.length === 0
                ? 'None'
                : authorList.format(summary.authors.map((author) => author.name))}
            </DetailRow>
            {/* Every kind is deposited as posted_content (depositTypeForKind). */}
            <DetailRow label="Content type">Preprint</DetailRow>
            <DetailRow label="Publication date">{formatPublicationDate(summary.date)}</DetailRow>
            <DetailRow label="Registration agency">Crossref</DetailRow>
            <DetailRow label="DOI prefix">{prefix}</DetailRow>
          </dl>
          <div className="text-sm">
            <p className="text-muted-foreground">DOI resolves to</p>
            <a
              href={resolvesTo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex gap-1 items-start break-all text-primary hover:underline"
            >
              {resolvesTo}
              <ExternalLink className="mt-0.5 w-4 h-4 shrink-0" aria-hidden />
            </a>
          </div>
        </Section>
        <Section title="Versioning policy">
          <div className="text-sm">
            <p className="font-medium">DOI links to latest</p>
            <p className="mt-1 text-muted-foreground">
              The DOI links to the latest published version of the Work.
            </p>
          </div>
        </Section>
        <ui.SimpleAlert
          type="info"
          size="compact"
          message={
            <>
              Once registered, the DOI will <strong>permanently identify</strong> this Work.
              Registration metadata can be updated later.
            </>
          }
        />
        <ui.DialogFooter>
          <ui.DialogClose asChild>
            <ui.Button variant="outline" disabled={submitting}>
              Cancel
            </ui.Button>
          </ui.DialogClose>
          <fetcher.Form method="post">
            <input type="hidden" name="formAction" value="register-doi" />
            <ui.Button type="submit" disabled={submitting}>
              {submitting ? 'Registering…' : 'Register DOI'}
            </ui.Button>
          </fetcher.Form>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
