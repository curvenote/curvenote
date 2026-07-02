import { Link, useFetcher, useNavigate } from 'react-router';
import { primitives, SiteLogo, cn, ui } from '@curvenote/scms-core';
import type { Workflow } from '@curvenote/scms-core';
import type { SubmissionWithVersionsAndSite } from '../works.$workId/types';
import { Loader2, Plus } from 'lucide-react';
import { useEffect } from 'react';

type SubmissionTargetSite = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  metadata: unknown;
  external: boolean;
};

type SiteVisualMetadata = {
  favicon?: string;
  logo?: string;
  logo_dark?: string;
};

type SubmitToSiteFetcherData = {
  success?: boolean;
  intent?: string;
  siteName?: string;
  submissionVersionId?: string;
  alreadySubmitted?: boolean;
  error?: string | { message?: string };
};

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

function getErrorMessage(data: SubmitToSiteFetcherData | undefined): string | null {
  if (!data?.error) return null;
  if (typeof data.error === 'string') return data.error;
  return data.error.message ?? 'Could not submit to site';
}

export function SubmittedToBar({
  submissions,
  workflows,
  basePath,
  canSubmitToSite,
  availableSites,
}: {
  submissions: SubmissionWithVersionsAndSite[];
  workflows: Record<string, Workflow>;
  basePath: string;
  canSubmitToSite: boolean;
  availableSites: SubmissionTargetSite[];
}) {
  const navigate = useNavigate();
  const fetcher = useFetcher<SubmitToSiteFetcherData>();
  const submittingSiteName = fetcher.formData?.get('siteName');
  const isSubmitting = fetcher.state !== 'idle';
  const submittedSiteNames = new Set(submissions.map((sub) => sub.site.name));

  useEffect(() => {
    if (fetcher.state !== 'idle' || fetcher.data?.intent !== 'submit-to-site') return;
    const errorMessage = getErrorMessage(fetcher.data);
    if (errorMessage) {
      ui.toastError(errorMessage);
      return;
    }
    if (fetcher.data.success && fetcher.data.siteName && fetcher.data.submissionVersionId) {
      navigate(
        `${basePath}/site/${fetcher.data.siteName}/submission/${fetcher.data.submissionVersionId}`,
      );
    }
  }, [basePath, fetcher.data, fetcher.state, navigate]);

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
          className="p-2 w-96 text-sm border shadow-lg bg-background text-foreground border-border"
          align="start"
          side="right"
          sideOffset={8}
        >
          {canSubmitToSite ? (
            <div className="space-y-2">
              <div className="px-2 py-1">
                <p className="text-sm font-medium">Submit to site</p>
                <p className="text-xs text-muted-foreground">
                  Choose an SCMS site to receive this work. External sites are listed first.
                </p>
              </div>
              {availableSites.length > 0 ? (
                <fetcher.Form method="post" action={basePath} className="space-y-1">
                  <input type="hidden" name="intent" value="submit-to-site" />
                  {availableSites.map((site) => {
                    const siteTitle = site.title ?? site.name;
                    const abbr = abbreviateTitle(siteTitle) || siteTitle.charAt(0).toUpperCase();
                    const metadata = site.metadata as SiteVisualMetadata | undefined;
                    const isCurrentSiteSubmitting = submittingSiteName === site.name;
                    const alreadySubmitted = submittedSiteNames.has(site.name);
                    return (
                      <button
                        key={site.id}
                        type="submit"
                        name="siteName"
                        value={site.name}
                        disabled={isSubmitting}
                        className={cn(
                          'flex gap-3 items-center p-2 w-full text-left rounded-md transition-colors',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          isSubmitting && 'opacity-70',
                        )}
                      >
                        <span className="flex overflow-hidden justify-center items-center w-9 h-9 rounded border bg-muted shrink-0 border-border">
                          {metadata?.logo != null || metadata?.logo_dark != null ? (
                            <SiteLogo
                              className="object-contain w-8 h-8"
                              alt={siteTitle}
                              logo={metadata?.logo}
                              logo_dark={metadata?.logo_dark}
                            />
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">
                              {abbr}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex gap-2 items-center">
                            {metadata?.favicon ? (
                              <img
                                src={metadata.favicon}
                                alt=""
                                className="object-contain w-4 h-4 shrink-0"
                              />
                            ) : null}
                            <span className="font-medium truncate">{siteTitle}</span>
                          </span>
                          <span className="block text-xs truncate text-muted-foreground">
                            {site.description ?? site.name}
                          </span>
                        </span>
                        <span className="flex gap-2 items-center shrink-0">
                          {alreadySubmitted ? (
                            <ui.Badge variant="secondary">Submitted</ui.Badge>
                          ) : null}
                          {isCurrentSiteSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </fetcher.Form>
              ) : (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  No SCMS sites are available for submission.
                </p>
              )}
            </div>
          ) : (
            <p className="p-2 leading-relaxed">
              Coming soon. To submit new works at the moment, use the Curvenote CLI or GitHub
              integrations.
            </p>
          )}
        </ui.PopoverContent>
      </ui.Popover>
    </primitives.Card>
  );
}
