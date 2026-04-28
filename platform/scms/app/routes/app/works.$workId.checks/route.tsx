import type { Route } from './+types/route';
import React from 'react';
import {
  withSecureWorkContext,
  makeDefaultWorkVersionMetadata,
  type WorkVersionMetadata,
  type ChecksMetadataSection,
} from '@curvenote/scms-server';
import type { FileMetadataSection } from '@curvenote/scms-core';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  httpError,
  scopes,
  getExtensionCheckServicesFromServerConfig,
  useDeploymentConfig,
  ui,
} from '@curvenote/scms-core';
import { formatWorkVersionDTO } from './db.server';
import {
  dbGetCheckServiceRunsByWorkVersionIds,
  type CheckServiceRunRow,
} from '../works.$workId/db.server';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { Tag } from './Tag';
import { RunCheckOnLatestVersionButton } from './RunCheckOnLatestVersionButton';
import { Timeline } from '../works.$workId.details/timeline/Timeline';
import { TimelineSection } from '../works.$workId.details/timeline/TimelineSection';
import { CheckServiceRunTimelineItem } from '../works.$workId.details/timeline/CheckServiceRunTimelineItem';
import { DateWithPopover } from '../works.$workId.details/timeline/DateWithPopover';

/** A check service run paired with the version context needed for display. */
export type ServiceRunEntry = {
  run: CheckServiceRunRow;
  workVersionId: string;
  /** Version number by date_created order (v1 = oldest). */
  versionNumber: number;
  /** ISO date for the work version (used for tooltip on the version tag). */
  versionDateCreated: string;
};

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.id.checks.read]);

  if (!ctx.work.versions || ctx.work.versions.length === 0) {
    throw httpError(404, 'No work version found');
  }

  const nonDraftVersions = ctx.work.versions.filter((v) => !v.draft);
  if (nonDraftVersions.length === 0) {
    throw httpError(404, 'No finalized work version found');
  }

  const latestVersion = nonDraftVersions[0];
  const metadata = (latestVersion.metadata ??
    makeDefaultWorkVersionMetadata()) as WorkVersionMetadata &
    FileMetadataSection &
    ChecksMetadataSection;

  const latestNonDraftWorkVersion = formatWorkVersionDTO(ctx, ctx.work.id, latestVersion);

  const nonDraftVersionIds = nonDraftVersions.map((v) => v.id);
  const runsByVersionId = await dbGetCheckServiceRunsByWorkVersionIds(nonDraftVersionIds);

  // Version numbering: v1 = oldest (by date_created).
  // `nonDraftVersions` is ordered desc by date_created (latest first), so the highest number is first.
  const versionNumberByWorkVersionId: Record<string, number> = {};
  nonDraftVersions.forEach((v, i) => {
    versionNumberByWorkVersionId[v.id] = nonDraftVersions.length - i;
  });

  // Build per-kind entries: for each version (newest → oldest) dedupe to that version's latest run
  // of that kind, then sort each kind's list desc by run.date_created.
  const entriesByKind: Record<string, ServiceRunEntry[]> = {};
  for (const version of nonDraftVersions) {
    const runs = runsByVersionId[version.id] ?? [];
    const seenKind = new Set<string>();
    for (const run of runs) {
      if (seenKind.has(run.kind)) continue;
      seenKind.add(run.kind);
      const list = entriesByKind[run.kind] ?? [];
      list.push({
        run,
        workVersionId: version.id,
        versionNumber: versionNumberByWorkVersionId[version.id] ?? 0,
        versionDateCreated: version.date_created,
      });
      entriesByKind[run.kind] = list;
    }
  }
  for (const kind of Object.keys(entriesByKind)) {
    entriesByKind[kind].sort((a, b) =>
      a.run.date_created > b.run.date_created
        ? -1
        : a.run.date_created < b.run.date_created
          ? 1
          : 0,
    );
  }

  const latestRunByServiceKind: Record<string, ServiceRunEntry> = {};
  const previousRunsByServiceKind: Record<string, ServiceRunEntry[]> = {};
  for (const [kind, list] of Object.entries(entriesByKind)) {
    const [head, ...rest] = list;
    latestRunByServiceKind[kind] = head;
    previousRunsByServiceKind[kind] = rest;
  }

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
    latestRunByServiceKind,
    previousRunsByServiceKind,
    manifestByServiceKind,
  } = loaderData;

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

  const renderVersionTag = (entry: ServiceRunEntry) => {
    const variant = entry.workVersionId === latestNonDraftWorkVersion.id ? 'latest' : 'previous';
    return (
      <span className="inline-flex gap-2 items-center">
        <Tag tag={`v${entry.versionNumber}`} variant={variant} />
        <DateWithPopover
          date={entry.run.date_modified}
          dateCreated={entry.run.date_created}
          dateModified={entry.run.date_modified}
          className="text-xs text-muted-foreground"
        />
      </span>
    );
  };

  return (
    <PageFrame
      title="Checks"
      description="Results of all check services run on the work are shown below. Each type of check is shown in a separate section and the most recent run is shown at the top. Where checks have been run on mulitple versions use the timeline to explore the history."
    >
      <div className="mt-4 space-y-12">
        {sortedCheckServices.map((service) => {
          const HeaderComponent = service.sectionHeaderComponent;
          const ActivityComponent = service.sectionActivityComponent;

          const latest = latestRunByServiceKind[service.id];
          const previous = previousRunsByServiceKind[service.id] ?? [];

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
          const tag = latest ? renderVersionTag(latest) : null;
          const isLatestRunOnLatestVersion =
            latest != null && latest.workVersionId === latestNonDraftWorkVersion.id;
          const headerAction =
            latest != null && !isLatestRunOnLatestVersion ? (
              <RunCheckOnLatestVersionButton
                actionPath={service.checksActionPath ?? `${basePath}/checks`}
                workVersionId={latestNonDraftWorkVersion.id}
              />
            ) : null;

          return (
            <div key={service.id} className="space-y-4">
              <HeaderComponent tag={tag} action={headerAction} metadata={serviceMetadata} />
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
                </ui.Card>
                {previous.length > 0 && (
                  <Timeline className="ml-3" nested>
                    {previous.map((entry) => (
                      <TimelineSection
                        key={entry.workVersionId}
                        label={renderVersionTag(entry)}
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
