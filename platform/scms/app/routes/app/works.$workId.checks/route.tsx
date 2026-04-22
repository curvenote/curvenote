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
  formatDate,
} from '@curvenote/scms-core';
import { formatWorkVersionDTO } from './db.server';
import {
  dbGetCheckServiceRunsByWorkVersionIds,
  type CheckServiceRunRow,
} from '../works.$workId/db.server';
import { extensions } from '../../../extensions/client';
import { Tag } from './Tag';
import { Timeline } from '../works.$workId.details/timeline/Timeline';
import { TimelineSection } from '../works.$workId.details/timeline/TimelineSection';
import { CheckServiceRunTimelineItem } from '../works.$workId.details/timeline/CheckServiceRunTimelineItem';

export type PreviousVersionWithRun = {
  workVersionId: string;
  date_created: string;
  /** Version number by date_created order (v1 = oldest) */
  versionNumber: number;
  run: CheckServiceRunRow;
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

  const workVersionDTO = formatWorkVersionDTO(ctx, ctx.work.id, latestVersion);

  const nonDraftVersionIds = nonDraftVersions.map((v) => v.id);
  const runsByVersionId = await dbGetCheckServiceRunsByWorkVersionIds(nonDraftVersionIds);
  const checkServiceRuns = runsByVersionId[latestVersion.id] ?? [];

  const versionNumberByWorkVersionId: Record<string, number> = {};
  nonDraftVersions.forEach((v, i) => {
    versionNumberByWorkVersionId[v.id] = nonDraftVersions.length - i;
  });

  const previousVersions = nonDraftVersions.slice(1);
  const previousVersionsWithRunsByService: Record<string, PreviousVersionWithRun[]> = {};
  for (const version of previousVersions) {
    const runs = runsByVersionId[version.id] ?? [];
    const seenKind = new Set<string>();
    for (const run of runs) {
      if (seenKind.has(run.kind)) continue;
      seenKind.add(run.kind);
      const list = previousVersionsWithRunsByService[run.kind] ?? [];
      list.push({
        workVersionId: version.id,
        date_created: version.date_created,
        versionNumber: versionNumberByWorkVersionId[version.id] ?? 0,
        run,
      });
      previousVersionsWithRunsByService[run.kind] = list;
    }
  }

  const latestVersionNumber = versionNumberByWorkVersionId[latestVersion.id] ?? 0;

  return {
    work: ctx.workDTO,
    workVersion: workVersionDTO,
    metadata,
    checkServiceRuns,
    previousVersionsWithRunsByService,
    latestVersionNumber,
  };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Check My Work', branding.title) }];
};

export default function CheckMyWorkPage({ loaderData }: Route.ComponentProps) {
  const {
    work,
    workVersion,
    checkServiceRuns,
    previousVersionsWithRunsByService,
    latestVersionNumber,
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
  const sortedCheckServices = checkServices
    .map((service, index) => {
      const latestRunDateCreated = [
        ...checkServiceRuns,
        ...(previousVersionsWithRunsByService[service.id] ?? []).map((entry) => entry.run),
      ]
        .filter((run) => run.kind === service.id)
        .reduce<number | null>((latest, run) => {
          const runTime = Date.parse(run.date_created);
          if (Number.isNaN(runTime)) return latest;
          if (latest == null) return runTime;
          return Math.max(latest, runTime);
        }, null);

      return { service, index, latestRunDateCreated };
    })
    .sort((a, b) => {
      if (a.latestRunDateCreated != null && b.latestRunDateCreated != null) {
        return b.latestRunDateCreated - a.latestRunDateCreated;
      }
      if (a.latestRunDateCreated != null) return -1;
      if (b.latestRunDateCreated != null) return 1;
      return a.index - b.index;
    })
    .map(({ service }) => service);

  const tag = (
    <ui.TooltipProvider delayDuration={1000}>
      <ui.Tooltip delayDuration={1000}>
        <ui.TooltipTrigger asChild>
          <span className="inline-block cursor-default">
            <Tag tag={`v${latestVersionNumber}`} />
          </span>
        </ui.TooltipTrigger>
        <ui.TooltipContent side="top" className="text-sm">
          {formatDate(workVersion.date_created, 'MMM d, yyyy h:mm:ss a')}
        </ui.TooltipContent>
      </ui.Tooltip>
    </ui.TooltipProvider>
  );
  const basePath = `/app/works/${work.id}`;

  return (
    <PageFrame
      title="Checks"
      description="View the status and results of check services that have been run on your work. The page below shows the most recent run for each available check service"
    >
      <div className="mt-4 space-y-6">
        {sortedCheckServices.map((service) => {
          const HeaderComponent = service.sectionHeaderComponent;
          const ActivityComponent = service.sectionActivityComponent;

          const existingRunFromThisService = checkServiceRuns.find(
            (run) => run.kind === service.id,
          );
          const runData = existingRunFromThisService?.data;
          const serviceMetadata =
            runData != null && typeof runData === 'object' && 'serviceData' in runData
              ? (runData as { serviceData: unknown }).serviceData
              : undefined;

          const previousEntries = previousVersionsWithRunsByService[service.id] ?? [];
          const showTimeline = previousEntries.length >= 1;

          return (
            <div key={service.id} className="space-y-4">
              <HeaderComponent tag={tag} />
              <div className="space-y-0">
                <ui.Card>
                  <ui.CardContent className="pt-6">
                    <ActivityComponent
                      metadata={
                        serviceMetadata as WorkVersionMetadata &
                          FileMetadataSection &
                          ChecksMetadataSection
                      }
                      workVersionId={workVersion.id}
                      checkRunId={existingRunFromThisService?.id}
                      remoteStatusActionPath={service.checksActionPath ?? `${basePath}/checks`}
                    />
                  </ui.CardContent>
                </ui.Card>
                {showTimeline && (
                  <Timeline className="ml-3" nested>
                    {previousEntries.map((entry) => (
                      <TimelineSection
                        key={entry.workVersionId}
                        label={
                          <ui.TooltipProvider delayDuration={1000}>
                            <ui.Tooltip delayDuration={1000}>
                              <ui.TooltipTrigger asChild>
                                <span className="cursor-default">v{entry.versionNumber}</span>
                              </ui.TooltipTrigger>
                              <ui.TooltipContent side="top" className="text-sm">
                                {formatDate(entry.date_created, 'MMM d, yyyy h:mm:ss a')}
                              </ui.TooltipContent>
                            </ui.Tooltip>
                          </ui.TooltipProvider>
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
