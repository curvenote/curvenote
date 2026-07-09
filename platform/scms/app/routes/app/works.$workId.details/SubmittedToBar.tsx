import { Link, useFetcher, useLocation, useNavigate } from 'react-router';
import {
  primitives,
  SiteLogo,
  cn,
  ui,
  RequestHelpDialog,
  useDeploymentConfig,
  useMyUser,
  truncate,
  buildWorkVersionNumberByIdMap,
} from '@curvenote/scms-core';
import type { ClientExtensionCheckService, Workflow } from '@curvenote/scms-core';
import type {
  SubmissionWithVersionsAndSite,
  WorkVersionForDetailsClient,
} from '../works.$workId/types';
import type { CheckServiceRunRow } from '../works.$workId/checkServiceRun.shared';
import { getCheckRunSummaryByKind } from '../works.$workId/checkServiceRunSummaries';
import { Check, ChevronDown, GitBranch, Loader2, Send } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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

function serviceDataFromRun(run: CheckServiceRunRow | undefined): unknown {
  if (!run) return undefined;
  const data = asRecord(run.data);
  return data?.serviceData ?? undefined;
}

function getVersionFiles(version: WorkVersionForDetailsClient): Record<string, unknown> {
  return asRecord(version.metadata?.files) ?? {};
}

function getFileLabel(key: string, value: unknown): string {
  const file = asRecord(value);
  return (
    (typeof file?.filename === 'string' && file.filename) ||
    (typeof file?.name === 'string' && file.name) ||
    key
  );
}

function getSubmittedSiteNamesForWorkVersion(version: WorkVersionForDetailsClient | undefined) {
  if (!version) return new Set<string>();
  return new Set(
    version.submissionVersions
      .filter((submissionVersion) => submissionVersion.status !== 'DRAFT')
      .map((submissionVersion) => submissionVersion.submission.site.name),
  );
}

function SubmitVersionLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="text-sm font-medium shrink-0">Version</span>
      <ui.VersionTagBadge tag={label} titlePrefix="Version" icon={GitBranch} />
    </span>
  );
}

function SubmitCheckSummaryBadgeSlot({ children }: { children: ReactNode }) {
  const slotRef = useRef<HTMLSpanElement>(null);
  const [fullLabel, setFullLabel] = useState<string | undefined>();

  useLayoutEffect(() => {
    const text = slotRef.current?.textContent?.replace(/\s+/g, ' ').trim();
    setFullLabel(text || undefined);
  });

  const slot = (
    <span
      ref={slotRef}
      className={cn(
        'inline-flex min-w-0 max-w-[9rem] overflow-hidden',
        '[&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:w-full [&_[data-slot=badge]]:!min-w-0',
        '[&_[data-slot=badge]]:shrink [&_[data-slot=badge]]:truncate [&_[data-slot=badge]]:justify-start',
      )}
    >
      {children}
    </span>
  );

  if (!fullLabel) return slot;

  return (
    <ui.SimpleTooltip title={fullLabel} side="top" sideOffset={6}>
      {slot}
    </ui.SimpleTooltip>
  );
}

function SubmitToSiteEarlyAccessMessage() {
  const [supportOpen, setSupportOpen] = useState(false);
  const location = useLocation();
  const user = useMyUser();
  const config = useDeploymentConfig();
  const helpConfig = config.statusBar?.items?.find((item) => item.type === 'request-help');
  const helpProps = helpConfig?.type === 'request-help' ? helpConfig.properties : undefined;

  const orcidAccount = user?.linkedAccounts?.find(
    (account) => account.provider === 'orcid' && !account.pending,
  );
  const orcid = orcidAccount?.idAtProvider || 'unknown';
  const currentPage = `${location.pathname}${location.search}${location.hash}`;

  return (
    <>
      <p className="leading-relaxed">
        To submit new works at the moment, use the Curvenote CLI or GitHub integrations. If you are
        interested in early access to the direct submission feature, please{' '}
        <ui.Button
          type="button"
          variant="link"
          className="inline p-0 h-auto align-baseline"
          onClick={() => setSupportOpen(true)}
        >
          contact support
        </ui.Button>
        .
      </p>
      <RequestHelpDialog
        orcid={orcid}
        open={supportOpen}
        onOpenChange={setSupportOpen}
        prompt={
          helpProps?.prompt ??
          'I am interested in early access to the direct submission feature from the work details page.'
        }
        title={helpProps?.title ?? helpProps?.label ?? 'Request help from the support team'}
        description={helpProps?.description}
        actionUrl="/app/request-help"
        successMessage={helpProps?.successMessage}
        currentPage={currentPage}
      />
    </>
  );
}

export function SubmittedToBar({
  submissions,
  workflows,
  basePath,
  canSubmitToSite,
  availableSites,
  versions,
  checkServiceRunsByWorkVersionId,
  checkServices,
  hasChecksFeature = false,
}: {
  submissions: SubmissionWithVersionsAndSite[];
  workflows: Record<string, Workflow>;
  basePath: string;
  canSubmitToSite: boolean;
  availableSites: SubmissionTargetSite[];
  versions: WorkVersionForDetailsClient[];
  checkServiceRunsByWorkVersionId: Record<string, CheckServiceRunRow[]>;
  checkServices: ClientExtensionCheckService[];
  hasChecksFeature?: boolean;
}) {
  const navigate = useNavigate();
  const fetcher = useFetcher<SubmitToSiteFetcherData>();
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const versionNumberByVersionId = useMemo(
    () => buildWorkVersionNumberByIdMap(versions),
    [versions],
  );
  const versionOptions = useMemo(() => {
    const completedVersions = versions.filter((version) => !version.draft);
    const sorted = [...completedVersions].sort((a, b) =>
      a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
    );
    return sorted.map((version) => ({
      version,
      label: `v${versionNumberByVersionId[version.id] ?? 0}`,
    }));
  }, [versions, versionNumberByVersionId]);
  const [selectedVersionId, setSelectedVersionId] = useState(versionOptions[0]?.version.id ?? '');
  const selectedVersion =
    versionOptions.find((option) => option.version.id === selectedVersionId)?.version ??
    versionOptions[0]?.version;
  const selectedVersionLabel =
    versionOptions.find((option) => option.version.id === selectedVersion?.id)?.label ?? 'version';
  const selectedFiles = selectedVersion ? getVersionFiles(selectedVersion) : {};
  const fileLabels = Object.entries(selectedFiles).map(([key, value]) => getFileLabel(key, value));
  // Checks surface the most recent run of each kind on the selected version and
  // any older versions — not on versions newer than the one chosen for submit.
  const latestRunByServiceKind = useMemo(() => {
    const selectedCreatedAt = selectedVersion?.date_created;
    const nonDraftVersions = [...versions]
      .filter((version) => !version.draft)
      .filter((version) => selectedCreatedAt == null || version.date_created <= selectedCreatedAt)
      .sort((a, b) =>
        a.date_created > b.date_created ? -1 : a.date_created < b.date_created ? 1 : 0,
      );
    return getCheckRunSummaryByKind(nonDraftVersions, checkServiceRunsByWorkVersionId)
      .latestRunByServiceKind;
  }, [
    versions,
    checkServiceRunsByWorkVersionId,
    selectedVersion?.date_created,
    selectedVersion?.id,
  ]);
  const fallbackCheckRows = Object.values(latestRunByServiceKind)
    .filter((entry) => !checkServices.some((service) => service.id === entry.run.kind))
    .map((entry) => ({ id: entry.run.kind, name: entry.run.kind, entry, service: undefined }));
  const checkRows = [
    ...checkServices.map((service) => ({
      id: service.id,
      name: service.name,
      entry: latestRunByServiceKind[service.id],
      service,
    })),
    ...fallbackCheckRows,
  ];
  const hasCompletedVersions = versionOptions.length > 0;
  const submittingSiteName = fetcher.formData?.get('siteName');
  const isSubmitting = fetcher.state !== 'idle';
  const submittedSiteNamesForSelectedVersion = useMemo(
    () => getSubmittedSiteNamesForWorkVersion(selectedVersion),
    [selectedVersion],
  );

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
            <span className="font-medium shrink-0" title={siteTitle}>
              {truncate(siteTitle, 14)}
            </span>
            <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} aria-hidden />
            <span className="text-muted-foreground shrink-0">{label}</span>
          </Link>
        );
      })}
      <ui.Popover>
        <ui.PopoverTrigger asChild>
          <ui.Button
            variant="ghost"
            className="rounded-none px-3 py-2.5 h-auto shrink-0 bg-background hover:bg-accent/50"
            aria-label="Submit to a new site"
          >
            <Send className="w-4 h-4 stroke-[1.5px] text-primary" />
          </ui.Button>
        </ui.PopoverTrigger>
        <ui.PopoverContent
          className={cn(
            'text-sm border shadow-lg bg-background text-foreground border-border',
            canSubmitToSite
              ? 'p-0 w-[min(760px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]'
              : 'p-4 w-80 max-w-[calc(100vw-2rem)]',
          )}
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={16}
        >
          {canSubmitToSite ? (
            <>
              <ui.PopoverArrow className="fill-background stroke-border stroke-[1px]" />
              <fetcher.Form method="post" action={basePath} className="grid grid-cols-[300px_1fr]">
                <input type="hidden" name="workVersionId" value={selectedVersion?.id ?? ''} />
                <div className="p-4 space-y-4 border-r border-border bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">Choose the version to submit</p>
                    <p className="text-xs text-muted-foreground">
                      Review available files, metadata, and checks before choosing a venue.
                    </p>
                  </div>

                  {hasCompletedVersions ? (
                    <ui.Popover open={versionDropdownOpen} onOpenChange={setVersionDropdownOpen}>
                      <ui.PopoverTrigger asChild>
                        <button
                          id="submit-version-select"
                          type="button"
                          className={cn(
                            'flex gap-3 justify-between items-center px-3 py-2 w-full h-16 text-left bg-white rounded-md border transition-colors border-input shadow-xs',
                            'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                          )}
                        >
                          {selectedVersion ? (
                            <span className="flex flex-col gap-1 items-start min-w-0">
                              <SubmitVersionLabel label={selectedVersionLabel} />
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  selectedVersion.date_modified ?? selectedVersion.date_created,
                                ).toLocaleDateString()}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Select a version</span>
                          )}
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                      </ui.PopoverTrigger>
                      <ui.PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={6}
                        className="p-1 w-[268px]"
                      >
                        <div className="space-y-1">
                          {versionOptions.map(({ version, label }) => {
                            const selected = version.id === selectedVersionId;
                            return (
                              <button
                                key={version.id}
                                type="button"
                                className={cn(
                                  'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors',
                                  'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                                  selected && 'bg-accent',
                                )}
                                onClick={() => {
                                  setSelectedVersionId(version.id);
                                  setVersionDropdownOpen(false);
                                }}
                              >
                                <span className="flex flex-col gap-1 items-start min-w-0">
                                  <SubmitVersionLabel label={label} />
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(
                                      version.date_modified ?? version.date_created,
                                    ).toLocaleDateString()}
                                  </span>
                                </span>
                                {selected ? (
                                  <Check className="w-4 h-4 text-primary shrink-0" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </ui.PopoverContent>
                    </ui.Popover>
                  ) : (
                    <p className="px-3 py-4 text-xs leading-relaxed rounded-md border border-dashed border-muted-foreground/40 bg-background text-muted-foreground">
                      No completed version is available to submit. Finish creating a version before
                      submitting to a site.
                    </p>
                  )}

                  {selectedVersion ? (
                    <>
                      {hasChecksFeature ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                            Checks
                          </p>
                          <div className="space-y-1.5">
                            {checkRows.length > 0 ? (
                              checkRows.map((row) => {
                                const SummaryTitleComponent =
                                  row.service?.sectionSummaryTitleComponent;
                                const SummaryBadgeComponent =
                                  row.service?.sectionSummaryBadgeComponent;
                                const run = row.entry?.run;
                                const metadata = serviceDataFromRun(run);
                                const fallbackScore = run ? getCheckScore(run) : null;
                                const runVersionNumber = row.entry
                                  ? versionNumberByVersionId[row.entry.workVersionId]
                                  : undefined;
                                const isFromOtherVersion =
                                  row.entry != null &&
                                  row.entry.workVersionId !== selectedVersion?.id;
                                return (
                                  <div
                                    key={row.id}
                                    className="flex gap-2 justify-between items-center p-2 rounded-md border bg-background border-border"
                                  >
                                    <span className="flex min-w-0 flex-1 items-center overflow-hidden [&_img]:max-h-5 [&_img]:w-auto [&_img]:object-contain [&_svg]:max-h-5 [&_svg]:w-auto [&_*]:truncate">
                                      {SummaryTitleComponent && run ? (
                                        <SummaryTitleComponent metadata={metadata} />
                                      ) : (
                                        <span className="text-xs font-medium truncate">
                                          {row.name}
                                        </span>
                                      )}
                                    </span>
                                    {run ? (
                                      <span className="flex gap-1.5 items-center min-w-0 shrink">
                                        {isFromOtherVersion && runVersionNumber != null ? (
                                          <ui.SimpleTooltip
                                            title={`Latest run was on version v${runVersionNumber}`}
                                            side="top"
                                            sideOffset={6}
                                          >
                                            <span className="inline-flex shrink-0">
                                              <ui.VersionTagBadge
                                                tag={`v${runVersionNumber}`}
                                                titlePrefix="Version"
                                                icon={GitBranch}
                                                disableTooltip
                                              />
                                            </span>
                                          </ui.SimpleTooltip>
                                        ) : null}
                                        <SubmitCheckSummaryBadgeSlot>
                                          {SummaryBadgeComponent ? (
                                            <SummaryBadgeComponent metadata={metadata} />
                                          ) : (
                                            <ui.Badge variant="success">
                                              {fallbackScore ? `Score ${fallbackScore}` : 'Run'}
                                            </ui.Badge>
                                          )}
                                        </SubmitCheckSummaryBadgeSlot>
                                      </span>
                                    ) : (
                                      <ui.Badge variant="outline-muted">Not run</ui.Badge>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No check services available.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                          Files
                        </p>
                        {fileLabels.length > 0 ? (
                          <ul className="space-y-1 text-[11px] leading-4 text-muted-foreground">
                            {Object.entries(selectedFiles).map(([key, value]) => (
                              <li key={key} className="truncate">
                                {getFileLabel(key, value)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            No files are available for this version.
                          </p>
                        )}
                      </div>
                    </>
                  ) : null}
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
                        const abbr =
                          abbreviateTitle(siteTitle) || siteTitle.charAt(0).toUpperCase();
                        const metadata = site.metadata as SiteVisualMetadata | undefined;
                        const isCurrentSiteSubmitting = submittingSiteName === site.name;
                        const alreadySubmitted = submittedSiteNamesForSelectedVersion.has(
                          site.name,
                        );
                        const isDisabled =
                          !hasCompletedVersions || isSubmitting || alreadySubmitted;
                        return (
                          <button
                            key={site.id}
                            type="submit"
                            name="siteName"
                            value={site.name}
                            disabled={isDisabled}
                            className={cn(
                              'flex gap-3 items-start p-2 w-full text-left rounded-md transition-colors',
                              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                              'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-transparent',
                              !isDisabled && 'hover:bg-accent',
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
                            <span className="flex-1 min-w-0">
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
                              <span className="block text-xs leading-snug whitespace-normal text-muted-foreground">
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
            </>
          ) : (
            <SubmitToSiteEarlyAccessMessage />
          )}
        </ui.PopoverContent>
      </ui.Popover>
    </primitives.Card>
  );
}
