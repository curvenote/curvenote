import type { Route } from './+types/route';
import { data } from 'react-router';
import React from 'react';
import {
  withSecureWorkContext,
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
import { extensions as serverExtensions } from '../../../extensions/server';
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
  const ctx = await withSecureWorkContext(args, [scopes.work.checks.read]);

  if (!ctx.work.versions || ctx.work.versions.length === 0) {
    throw httpError(404, 'No work version found');
  }

  const nonDraftVersions = ctx.work.versions.filter((v) => !v.draft);
  if (nonDraftVersions.length === 0) {
    throw httpError(404, 'No finalized work version found');
  }

  const latestVersion = nonDraftVersions[0];
  const metadata = (latestVersion.metadata ?? {
    version: 1,
  }) as WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;

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

export async function action(args: Route.ActionArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.checks.dispatch]);

  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  if (!ctx.work.versions || ctx.work.versions.length === 0) {
    return data({ error: { type: 'general', message: 'No work version found' } }, { status: 404 });
  }

  const nonDraftVersions = ctx.work.versions.filter((v) => !v.draft);
  const latestVersion = nonDraftVersions[0];
  if (!latestVersion) {
    return data({ error: { type: 'general', message: 'No work version found' } }, { status: 404 });
  }

  // Get metadata
  const metadata = (latestVersion.metadata ?? { version: 1 }) as WorkVersionMetadata &
    FileMetadataSection &
    ChecksMetadataSection;

  // Try to route action to a check service handler
  // Use server extensions here so we see server-only fields like handleAction/status.
  const checkServices = getExtensionCheckServicesFromServerConfig(ctx.$config, serverExtensions);
  for (const service of checkServices) {
    if (service.handleAction) {
      // Check if this service handles this intent
      if (intent.startsWith(service.id) || intent.includes(service.id)) {
        try {
          return await service.handleAction({
            intent,
            formData,
            workVersionId: latestVersion.id,
            metadata,
            ctx,
            serverExtensions,
          });
        } catch (error) {
          return data(
            {
              error: {
                type: 'general',
                message: error instanceof Error ? error.message : 'Action handler failed',
              },
            },
            { status: 500 },
          );
        }
      }
    }
  }

  return data({ error: { type: 'general', message: 'Unknown intent' } }, { status: 400 });
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

  const tag = (
    <ui.TooltipProvider delayDuration={1000}>
      <ui.Tooltip delayDuration={1000}>
        <ui.TooltipTrigger asChild>
          <span className="inline-block cursor-default">
            <Tag tag={`v${latestVersionNumber} (latest)`} />
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
    <PageFrame title="Check My Work">
      <div className="mt-4 space-y-6">
        {checkServices.map((service) => {
          const HeaderComponent = service.sectionHeaderComponent;
          const ActivityComponent = service.sectionActivityComponent as React.ComponentType<{
            metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;
          }>;

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
