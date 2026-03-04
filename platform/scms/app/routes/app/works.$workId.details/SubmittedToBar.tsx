import { Link } from 'react-router';
import { primitives, SiteLogo, cn, ui } from '@curvenote/scms-core';
import type { Workflow } from '@curvenote/scms-core';
import type { SubmissionWithVersionsAndSite } from '../works.$workId/types';
import { Plus } from 'lucide-react';

function getStatusLabelAndDot(
  workflows: Record<string, Workflow>,
  workflowName: string,
  status: string,
): { label: string; dotClass: string } {
  const workflow = workflows[workflowName];
  const state = workflow?.states?.[status];
  const label = state?.label ?? status;
  const tags = state?.tags ?? [];
  const hasEnd = tags.includes('end');
  const hasError = tags.includes('error');
  const hasWarning = tags.includes('warning');
  let dotClass = 'bg-muted-foreground/50';
  if (hasError) dotClass = 'bg-destructive';
  else if (hasWarning) dotClass = 'bg-orange-500';
  else if (hasEnd && !hasError && !hasWarning) dotClass = 'bg-green-500';
  return { label, dotClass };
}

/** First letter of each word, joined and uppercased e.g. "Agrogeo 2026" → "A2" */
function abbreviateTitle(title: string): string {
  if (!title || !title.trim()) return '';
  return title
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

export function SubmittedToBar({
  submissions,
  workflows,
  basePath,
}: {
  submissions: SubmissionWithVersionsAndSite[];
  workflows: Record<string, Workflow>;
  basePath: string;
}) {
  return (
    <primitives.Card
      lift
      className={cn(
        'p-0 flex flex-wrap rounded-lg border border-border overflow-hidden w-full max-w-full bg-muted/30',
        '[&>*]:border-r [&>*]:border-border [&>*:last-child]:border-r-0',
      )}
      role="group"
    >
      <div className="inline-flex items-center px-4 py-2.5 text-xs font-semibold tracking-wider uppercase text-muted-foreground bg-background shrink-0">
        Submitted to
      </div>
      {submissions.map((sub) => {
        const latest = sub.versions[0];
        if (!latest) return null;
        const linkTarget = `${basePath}/site/${sub.site.name}/submission/${latest.id}`;
        const { label, dotClass } = getStatusLabelAndDot(
          workflows,
          sub.collection.workflow,
          latest.status,
        );
        const siteTitle = sub.site.title ?? sub.site.name;
        const abbr = abbreviateTitle(siteTitle) || siteTitle.charAt(0).toUpperCase();
        const metadata = sub.site.metadata as { logo?: string; logo_dark?: string } | undefined;
        return (
          <Link
            key={sub.id}
            to={linkTarget}
            prefetch="intent"
            className={cn(
              'inline-flex gap-2 items-center px-4 py-2.5 text-sm bg-background',
              'no-underline transition-colors text-foreground hover:bg-accent/50',
              'min-w-0 flex-1 sm:flex-initial',
            )}
          >
            {metadata?.logo != null || metadata?.logo_dark != null ? (
              <SiteLogo
                className="object-contain w-6 h-6 shrink-0"
                alt={siteTitle}
                logo={metadata?.logo}
                logo_dark={metadata?.logo_dark}
              />
            ) : (
              <span className="flex justify-center items-center w-6 h-6 text-xs font-medium rounded shrink-0 bg-muted text-muted-foreground">
                {abbr}
              </span>
            )}
            <span className="font-medium truncate">{abbr}</span>
            <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} aria-hidden />
            <span className="text-muted-foreground shrink-0">{label}</span>
          </Link>
        );
      })}
      <ui.Popover>
        <ui.PopoverTrigger
          className={cn(
            'inline-flex items-center justify-center p-2.5 border-dashed border-muted-foreground/40',
            'cursor-pointer bg-muted/30 text-muted-foreground shrink-0 hover:bg-muted/50 hover:text-foreground transition-colors rounded-r-lg',
          )}
          aria-label="Submit to a new site"
        >
          <Plus className="w-4 h-4" />
        </ui.PopoverTrigger>
        <ui.PopoverContent
          className="p-4 w-80 text-sm border shadow-lg bg-background text-foreground border-border"
          align="end"
          side="bottom"
        >
          <p className="leading-relaxed">
            Coming soon. To submit new works at the moment, use the Curvenote CLI or GitHub
            integrations.
          </p>
        </ui.PopoverContent>
      </ui.Popover>
    </primitives.Card>
  );
}
