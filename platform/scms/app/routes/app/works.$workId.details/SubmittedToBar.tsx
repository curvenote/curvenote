import { Link, useFetcher, useNavigate } from 'react-router';
import { primitives, SiteLogo, cn, ui } from '@curvenote/scms-core';
import type { Workflow } from '@curvenote/scms-core';
import type {
  SubmissionWithVersionsAndSite,
  WorkVersionForDetailsClient,
} from '../works.$workId/types';
import type { CheckServiceRunRow } from '../works.$workId/db.server';
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNestedRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  return asRecord(record[key]);
}

function formatScore(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value > 0 && value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value));
  }
  if (typeof value === 'string' && value.trim() !== '') return value;
  return null;
}

function getCheckScore(run: CheckServiceRunRow): string | null {
  const data = asRecord(run.data);
  if (!data) return null;
  const serviceData = getNestedRecord(data, 'serviceData') ?? data;
  const summary = getNestedRecord(serviceData, 'summary');
  const result = getNestedRecord(serviceData, 'result');
  const checks = getNestedRecord(serviceData, 'checks');
  const checksSummary = checks ? getNestedRecord(checks, 'summary') : null;
  return (
    formatScore(serviceData.score) ??
    formatScore(summary?.score) ??
    formatScore(result?.score) ??
    formatScore(checksSummary?.score)
  );
}

function getVersionFiles(version: WorkVersionForDetailsClient): Record<string, unknown> {
  return asRecord(version.metadata?.files) ?? {};
}

function getFileLabel(key: string, value: unknown): string {
  const file = asRecord(value);
  const label =
    (typeof file?.filename === 'string' && file.filename) ||
    (typeof file?.name === 'string' && file.name) ||
    key;
  const extension = label.split('.').pop();
  return extension && extension !== label ? extension.toUpperCase() : label;
}

export function SubmittedToBar({
  submissions,
  workflows,
  basePath,
  canSubmitToSite,
  availableSites,
  versions,
  checkServiceRunsByWorkVersionId,
}: {
  submissions: SubmissionWithVersionsAndSite[];
  workflows: Record<string, Workflow>;
  basePath: string;
  canSubmitToSite: boolean;
  availableSites: SubmissionTargetSite[];
  versions: WorkVersionForDetailsClient[];
  checkServiceRunsByWorkVersionId: Record<string, CheckServiceRunRow[]>;
}) {
  const navigate = useNavigate();
  const fetcher = useFetcher<SubmitToSiteFetcherData>();
  const versionOptions = useMemo(() => {
    const completedVersions = versions.filter((version) => !version.draft);
    const selectableVersions = completedVersions.length > 0 ? completedVersions : versions;
    const sorted = [...selectableVersions].sort((a, b) =>
      a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
    );
    const versionNumberByVersionId: Record<string, number> = {};
    [...versions]
      .sort((a, b) =>
        a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
      )
      .forEach((version, index) => {
        versionNumberByVersionId[version.id] = versions.length - index;
      });
    return sorted.map((version) => ({
      version,
      label: `v${versionNumberByVersionId[version.id] ?? 0}`,
    }));
  }, [versions]);
  const [selectedVersionId, setSelectedVersionId] = useState(versionOptions[0]?.version.id ?? '');
  const selectedVersion =
    versionOptions.find((option) => option.version.id === selectedVersionId)?.version ??
    versionOptions[0]?.version;
  const selectedVersionLabel =
    versionOptions.find((option) => option.version.id === selectedVersion?.id)?.label ?? 'version';
  const selectedCheckRuns = selectedVersion
    ? (checkServiceRunsByWorkVersionId[selectedVersion.id] ?? [])
    : [];
  const selectedFiles = selectedVersion ? getVersionFiles(selectedVersion) : {};
  const fileLabels = Object.entries(selectedFiles).map(([key, value]) => getFileLabel(key, value));
  const metadataKeys = selectedVersion?.metadataSummary?.keys ?? [];
  const checkKinds = Array.from(new Set(selectedCheckRuns.map((run) => run.kind))).filter(Boolean);
  const score = selectedCheckRuns
    .map(getCheckScore)
    .find((value): value is string => Boolean(value));
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

  useEffect(() => {
    if (selectedVersionId || !versionOptions[0]) return;
    setSelectedVersionId(versionOptions[0].version.id);
  }, [selectedVersionId, versionOptions]);

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
          className="p-0 w-[760px] text-sm border shadow-lg bg-background text-foreground border-border"
          align="start"
          side="right"
          sideOffset={8}
        >
          {canSubmitToSite ? (
            <fetcher.Form method="post" action={basePath} className="grid grid-cols-[300px_1fr]">
              <input type="hidden" name="workVersionId" value={selectedVersion?.id ?? ''} />
              <div className="p-4 space-y-4 border-r border-border bg-muted/20">
                <div>
                  <p className="text-sm font-medium">Choose the version to submit</p>
                  <p className="text-xs text-muted-foreground">
                    Review available files, metadata, and checks before choosing a venue.
                  </p>
                </div>

                {selectedVersion ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                        Version summary
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <ui.Badge variant="primary">{selectedVersionLabel}</ui.Badge>
                        <ui.Badge variant="outline-muted">
                          {selectedCheckRuns.length} checks
                        </ui.Badge>
                        {score ? <ui.Badge variant="success">Score {score}</ui.Badge> : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                        Checks run
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {checkKinds.length > 0 ? (
                          checkKinds.slice(0, 4).map((kind) => (
                            <ui.Badge key={kind} variant="outline-muted">
                              {kind}
                            </ui.Badge>
                          ))
                        ) : (
                          <ui.Badge variant="outline-muted">No checks</ui.Badge>
                        )}
                        {checkKinds.length > 4 ? (
                          <ui.Badge variant="outline-muted">+{checkKinds.length - 4}</ui.Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                        Metadata
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {metadataKeys.length > 0 ? (
                          metadataKeys.slice(0, 4).map((key) => (
                            <ui.Badge key={key} variant="outline-muted">
                              {key}
                            </ui.Badge>
                          ))
                        ) : (
                          <ui.Badge variant="outline-muted">No metadata</ui.Badge>
                        )}
                        {metadataKeys.length > 4 ? (
                          <ui.Badge variant="outline-muted">+{metadataKeys.length - 4}</ui.Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                        Files
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {fileLabels.length > 0 ? (
                          fileLabels.slice(0, 4).map((label, index) => (
                            <ui.Badge key={`${label}-${index}`} variant="outline-muted">
                              {label}
                            </ui.Badge>
                          ))
                        ) : (
                          <ui.Badge variant="outline-muted">No files</ui.Badge>
                        )}
                        {fileLabels.length > 4 ? (
                          <ui.Badge variant="outline-muted">+{fileLabels.length - 4}</ui.Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <ui.Label htmlFor="submit-version-select">Version</ui.Label>
                  <ui.Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                    <ui.SelectTrigger id="submit-version-select" size="sm" className="w-full">
                      <ui.SelectValue placeholder="Select a version" />
                    </ui.SelectTrigger>
                    <ui.SelectContent>
                      {versionOptions.map(({ version, label }) => (
                        <ui.SelectItem key={version.id} value={version.id}>
                          {label} · {new Date(version.date_created).toLocaleDateString()}
                        </ui.SelectItem>
                      ))}
                    </ui.SelectContent>
                  </ui.Select>
                </div>
              </div>

              <div className="p-2 space-y-2">
                <div className="px-2 py-1">
                  <p className="text-sm font-medium">Submit to site</p>
                  <p className="text-xs text-muted-foreground">
                    Choose an SCMS site to receive this work. External sites are listed first.
                  </p>
                </div>
                {availableSites.length > 0 ? (
                  <div className="space-y-1">
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
                  </div>
                ) : (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    No SCMS sites are available for submission.
                  </p>
                )}
              </div>
            </fetcher.Form>
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
