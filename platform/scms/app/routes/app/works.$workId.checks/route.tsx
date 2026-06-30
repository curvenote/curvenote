import type { Route } from './+types/route';
import React, { useEffect, useState } from 'react';
import { useLocation, useRevalidator } from 'react-router';
import {
  withSecureWorkContext,
  makeDefaultWorkVersionMetadata,
  type WorkVersionMetadata,
  type ChecksMetadataSection,
} from '@curvenote/scms-server';
import type { FileMetadataSection } from '@curvenote/scms-core';
import { GitBranch } from 'lucide-react';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  httpError,
  scopes,
  getExtensionCheckServicesFromServerConfig,
  DateWithPopover,
  formatDate,
  formatDatetime,
  Timeline,
  TimelineSection,
  CheckServiceRunTimelineItem,
  useDeploymentConfig,
  ui,
} from '@curvenote/scms-core';
import { dbGetLatestNonDraftWorkVersion, formatWorkVersionDTO } from './db.server';
import { dbGetCheckServiceRunsByWorkVersionIds } from '../works.$workId/db.server';
import {
  getCheckRunSummaryByKind,
  type ServiceRunEntry,
} from '../works.$workId/checkServiceRunSummaries';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { RunCheckOnLatestVersionButton } from './RunCheckOnLatestVersionButton';

const DISPATCHING_SKELETON_MS = 1500;

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.id.checks.read]);

  if (!ctx.work.versions || ctx.work.versions.length === 0) {
    throw httpError(404, 'No work version found');
  }

  const nonDraftVersions = ctx.work.versions.filter((v) => !v.draft);
  if (nonDraftVersions.length === 0) {
    throw httpError(404, 'No finalized work version found');
  }

  const latestVersion = await dbGetLatestNonDraftWorkVersion(ctx.work.id);
  if (!latestVersion) {
    throw httpError(404, 'No finalized work version found');
  }

  const metadata = (latestVersion.metadata ??
    makeDefaultWorkVersionMetadata()) as WorkVersionMetadata &
    FileMetadataSection &
    ChecksMetadataSection;

  const latestNonDraftWorkVersion = formatWorkVersionDTO(ctx, ctx.work.id, latestVersion);

  const nonDraftVersionIds = nonDraftVersions.map((v) => v.id);
  const runsByVersionId = await dbGetCheckServiceRunsByWorkVersionIds(nonDraftVersionIds);
  const { latestRunByServiceKind, previousRunsByServiceKind } = getCheckRunSummaryByKind(
    nonDraftVersions,
    runsByVersionId,
  );

  // -------------------------------------------------------------------------
  // TEMPORARY (stepping-stone): service-manifest fallback for kinds with no run.
  //
  // Section header and activity components currently read the service manifest
  // (logo, title, ...) from each run's `serviceData.manifest`, which is only
  // stamped at execute time. The page renders a section for every check
  // service configured in the deployment (not just those in
  // `metadata.checks.enabled` for this work), so for any service without a
  // run we still want the correct logo + CTA. We ask each server extension
  // for its merged config and keep only the `manifest` here. The render path
  // below synthesizes `{ manifest }` as a stand-in `serviceData`.
  //
  // Remove this block (and the matching `fallbackManifest` logic in the
  // component) once the CTA rework lands and sections can render without a
  // run-derived manifest.
  // -------------------------------------------------------------------------
  const extensionByCheckServiceId = new Map<string, (typeof serverExtensions)[number]>();
  for (const ext of serverExtensions) {
    const services = ext.getChecks?.() ?? [];
    for (const svc of services) {
      extensionByCheckServiceId.set(svc.id, ext);
    }
  }
  // Mirror the list of services the page will render (same util the component
  // uses). Any service id that doesn't yet have a run needs a manifest fallback.
  const pageCheckServices = getExtensionCheckServicesFromServerConfig(
    ctx.$config,
    serverExtensions,
  );
  const kindsNeedingManifest = pageCheckServices
    .map((s) => s.id)
    .filter((kind) => latestRunByServiceKind[kind] == null);
  const manifestByServiceKind: Record<string, unknown> = {};
  for (const kind of kindsNeedingManifest) {
    const ext = extensionByCheckServiceId.get(kind);
    if (!ext?.getExtensionConfiguration) continue;
    try {
      const cfg = await ext.getExtensionConfiguration(ctx);
      const m = (cfg as Record<string, unknown> | undefined)?.manifest;
      if (m && typeof m === 'object') {
        manifestByServiceKind[kind] = m;
      }
    } catch (err) {
      console.warn(`[works.$workId.checks] failed to load manifest fallback for kind=${kind}`, err);
    }
  }
  // ------------------------------- END TEMPORARY ---------------------------

  return {
    work: ctx.workDTO,
    latestNonDraftWorkVersion,
    metadata,
    latestRunByServiceKind,
    previousRunsByServiceKind,
    manifestByServiceKind,
  };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Check My Work', branding.title) }];
};

export default function CheckMyWorkPage({ loaderData }: Route.ComponentProps) {
  const {
    work,
    latestNonDraftWorkVersion,
    metadata,
    latestRunByServiceKind,
    previousRunsByServiceKind,
    manifestByServiceKind,
  } = loaderData;
  const location = useLocation();
  const revalidator = useRevalidator();
  const dispatchingFromUpload = new URLSearchParams(location.search).get('dispatching') === '1';
  const [showDispatchingSkeletons, setShowDispatchingSkeletons] = useState(dispatchingFromUpload);

  const deploymentConfig = useDeploymentConfig();
  const extensionsConfig: Record<string, { checks?: boolean }> = {};
  if (deploymentConfig.extensions) {
    for (const [extId, extInfo] of Object.entries(deploymentConfig.extensions)) {
      if (extInfo.capabilities?.includes('checks')) {
        extensionsConfig[extId] = { checks: true };
      }
    }
  }
  const checkServices = getExtensionCheckServicesFromServerConfig(
    { app: { extensions: extensionsConfig } } as unknown as AppConfig,
    extensions,
  );

  // Order services: those with any run first (desc by latest run date_created),
  // then services with no runs in original config order.
  const sortedCheckServices = checkServices
    .map((service, index) => ({
      service,
      index,
      latestRunDateCreated: latestRunByServiceKind[service.id]?.run.date_created ?? null,
    }))
    .sort((a, b) => {
      if (a.latestRunDateCreated != null && b.latestRunDateCreated != null) {
        return a.latestRunDateCreated > b.latestRunDateCreated
          ? -1
          : a.latestRunDateCreated < b.latestRunDateCreated
            ? 1
            : 0;
      }
      if (a.latestRunDateCreated != null) return -1;
      if (b.latestRunDateCreated != null) return 1;
      return a.index - b.index;
    })
    .map(({ service }) => service);

  const basePath = `/app/works/${work.id}`;
  const enabledCheckKinds = metadata.checks?.enabled ?? [];
  const enabledCheckKindSet = new Set<string>(enabledCheckKinds);
  const hasPendingLatestRun = enabledCheckKinds.some(
    (kind) => latestRunByServiceKind[kind]?.workVersionId !== latestNonDraftWorkVersion.id,
  );
  const showDispatchingState = dispatchingFromUpload && hasPendingLatestRun;

  useEffect(() => {
    if (!dispatchingFromUpload) {
      setShowDispatchingSkeletons(false);
      return;
    }
    setShowDispatchingSkeletons(true);
    const timeout = window.setTimeout(() => {
      setShowDispatchingSkeletons(false);
      revalidator.revalidate();
    }, DISPATCHING_SKELETON_MS);
    return () => window.clearTimeout(timeout);
  }, [dispatchingFromUpload, location.search, revalidator]);

  useEffect(() => {
    if (!showDispatchingState) return;
    const interval = window.setInterval(() => {
      if (revalidator.state === 'idle') {
        revalidator.revalidate();
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [showDispatchingState, revalidator]);

  const renderWorkVersionDate = (entry: ServiceRunEntry) => {
    const versionDate = formatDate(entry.versionDateCreated, 'MMM dd, y HH:mm');
    return (
      <span
        className="inline-flex gap-1.5 items-center text-xs text-muted-foreground"
        title={formatDatetime(entry.versionDateCreated)}
      >
        <GitBranch className="size-3.5 shrink-0" aria-hidden />
        <span>{versionDate}</span>
      </span>
    );
  };

  return (
    <PageFrame
      title="Checks"
      description="Results of all check services run on the work are shown below. Each type of check is shown in a separate section and the most recent run is shown at the top. Where checks have been run on mulitple versions use the timeline to explore the history."
    >
      {showDispatchingState ? (
        <ui.Card className="mt-4 border-primary/30 bg-primary/5">
          <ui.CardContent className="py-4">
            <p className="text-sm font-medium">Checks are starting</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your work has been confirmed and the selected checks are being dispatched. Results
              will appear here as soon as each check service creates its run.
            </p>
          </ui.CardContent>
        </ui.Card>
      ) : null}
      <div className="mt-4 space-y-12">
        {sortedCheckServices.map((service) => {
          const HeaderComponent = service.sectionHeaderComponent;
          const ActivityComponent = service.sectionActivityComponent;

          const latest = latestRunByServiceKind[service.id];
          const previous = previousRunsByServiceKind[service.id] ?? [];
          const isSelectedPendingService =
            enabledCheckKindSet.has(service.id) &&
            latest?.workVersionId !== latestNonDraftWorkVersion.id;

          if (showDispatchingSkeletons && isSelectedPendingService) {
            return (
              <div key={service.id} className="space-y-4">
                <ui.Card className="border-dashed">
                  <ui.CardContent className="py-6">
                    <div className="space-y-4 animate-pulse">
                      <div className="flex gap-4 justify-between items-center">
                        <div className="space-y-2">
                          <div className="w-40 h-4 rounded bg-muted" />
                          <div className="w-64 h-3 rounded bg-muted" />
                        </div>
                        <div className="w-28 h-8 rounded bg-muted" />
                      </div>
                      <div className="h-20 rounded bg-muted/70" />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">Starting {service.name}...</p>
                  </ui.CardContent>
                </ui.Card>
              </div>
            );
          }

          const runData = latest?.run.data;
          const runServiceData =
            runData != null && typeof runData === 'object' && 'serviceData' in runData
              ? (runData as { serviceData: unknown }).serviceData
              : undefined;
          // TEMPORARY (stepping-stone): see loader block of the same name.
          // When a kind has no run yet, fall back to a synthetic serviceData
          // object carrying just the manifest so the header logo / CTA can
          // render. Remove alongside the loader block once the CTA rework lands.
          const fallbackManifest = manifestByServiceKind[service.id];
          const serviceMetadata: unknown =
            runServiceData ??
            (fallbackManifest ? ({ manifest: fallbackManifest } as any) : undefined);

          const workVersionIdForActivity = latest?.workVersionId ?? latestNonDraftWorkVersion.id;
          const isLatestRunOnLatestVersion =
            latest != null && latest.workVersionId === latestNonDraftWorkVersion.id;
          const headerAction =
            latest != null && !isLatestRunOnLatestVersion ? (
              <RunCheckOnLatestVersionButton
                actionPath={service.checksActionPath ?? `${basePath}/checks`}
                workVersionId={latestNonDraftWorkVersion.id}
                checkServiceId={service.id}
              />
            ) : null;

          return (
            <div key={service.id} className="space-y-4">
              <HeaderComponent tag={null} action={headerAction} metadata={serviceMetadata} />
              <div className="space-y-0">
                <ui.Card>
                  <ui.CardContent className="pt-6">
                    <ActivityComponent
                      metadata={
                        serviceMetadata as WorkVersionMetadata &
                          FileMetadataSection &
                          ChecksMetadataSection
                      }
                      workVersionId={workVersionIdForActivity}
                      checkRunId={latest?.run.id}
                      remoteStatusActionPath={service.checksActionPath ?? `${basePath}/checks`}
                      checkRunDateModified={latest?.run.date_modified}
                    />
                  </ui.CardContent>
                  {latest ? (
                    <div className="flex justify-start py-1.5 pr-6 pl-3 border-t border-border">
                      {renderWorkVersionDate(latest)}
                    </div>
                  ) : null}
                </ui.Card>
                {previous.length > 0 && (
                  <Timeline className="ml-3" nested>
                    {previous.map((entry) => (
                      <TimelineSection
                        key={entry.workVersionId}
                        label={
                          <span className="inline-flex gap-2 items-center">
                            {renderWorkVersionDate(entry)}
                            <DateWithPopover
                              date={entry.run.date_modified}
                              dateCreated={entry.run.date_created}
                              dateModified={entry.run.date_modified}
                              className="text-xs text-muted-foreground"
                            />
                          </span>
                        }
                        nested
                      >
                        <CheckServiceRunTimelineItem
                          run={entry.run}
                          checkService={service}
                          basePath={basePath}
                        />
                      </TimelineSection>
                    ))}
                  </Timeline>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageFrame>
  );
}
