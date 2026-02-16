import type { Route } from './+types/route';
import { data } from 'react-router';
import React from 'react';
import {
  getPrismaClient,
  withSecureWorkContext,
  type WorkVersionMetadata,
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
} from '@curvenote/scms-core';
import { CurvenoteStructureChecksSection } from './CurvenoteStructureChecksSection';
import { formatWorkVersionDTO } from './db.server';
import type { ChecksMetadataSection } from '../works.$workId.upload.$workVersionId/checks.schema';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { jobs, registerExtensionJobs } from '@curvenote/scms-server';
import { uuidv7 as uuid } from 'uuidv7';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.checks.read]);

  // Get the latest work version from context (versions are already sorted by date_created desc)
  if (!ctx.work.versions || ctx.work.versions.length === 0) {
    throw httpError(404, 'No work version found');
  }

  const latestVersion = ctx.work.versions[0];
  const metadata = (latestVersion.metadata ?? {
    version: 1,
  }) as WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;

  const workVersionDTO = formatWorkVersionDTO(ctx, ctx.work.id, latestVersion);

  const prisma = await getPrismaClient();
  const checkServiceRuns = await prisma.checkServiceRun.findMany({
    where: { work_version_id: latestVersion.id }, // just the latest version for now
    orderBy: { date_created: 'desc' },
  });

  return {
    work: ctx.workDTO,
    workVersion: workVersionDTO,
    metadata,
    checkServiceRuns,
  };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.checks.dispatch]);

  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  // Get the latest work version from context (versions are already sorted by date_created desc)
  if (!ctx.work.versions || ctx.work.versions.length === 0) {
    return data({ error: { type: 'general', message: 'No work version found' } }, { status: 404 });
  }

  const latestVersion = ctx.work.versions[0];
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
  const createJob = (jobType: string, payload: Record<string, unknown>) =>
    jobs.invoke(
      ctx,
      { id: uuid(), job_type: jobType, payload, results: undefined },
      registerExtensionJobs(serverExtensions),
    );
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
  return [{ title: joinPageTitle('Work Integrity', branding.title) }];
};

export default function WorkIntegrityPage({ loaderData }: Route.ComponentProps) {
  const { work, workVersion, checkServiceRuns } = loaderData;

  // Resolve check services at render time to avoid serialization issues
  // Construct minimal AppConfig from ClientDeploymentConfig
  const deploymentConfig = useDeploymentConfig();
  const extensionsConfig: Record<string, { checks?: boolean }> = {};
  if (deploymentConfig.extensions) {
    for (const [extId, extInfo] of Object.entries(deploymentConfig.extensions)) {
      // If 'checks' is in capabilities, enable it
      if (extInfo.capabilities.includes('checks')) {
        extensionsConfig[extId] = { checks: true };
      }
    }
  }
  const checkServices = getExtensionCheckServicesFromServerConfig(
    { app: { extensions: extensionsConfig } } as unknown as AppConfig,
    extensions,
  );

  const truncatedTitle = work.title
    ? workVersion.title.length > 32
      ? workVersion.title.substring(0, 32) + '...'
      : workVersion.title
    : 'Untitled Work';

  const breadcrumbs = [
    { label: 'Works', href: '/app/works' },
    { label: truncatedTitle, href: `/app/works/${work.id}` },
    { label: 'Work Integrity', isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Work Integrity"
      subtitle="Run integrity checks on this work"
      breadcrumbs={breadcrumbs}
    >
      <div className="mt-4 space-y-6">
        {/* Dynamically render check sections from extensions */}
        {checkServices.map((service) => {
          const Component = service.checksSectionComponent as React.ComponentType<{
            metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;
          }>;

          const existingRunFromThisService = checkServiceRuns.find(
            (run) => run.kind === service.id,
          );

          return (
            <React.Fragment key={service.id}>
              <Component metadata={(existingRunFromThisService?.data as any)?.serviceData} />
              <details>
                <summary>Debug Info</summary>
                <pre className="p-2 text-xs bg-gray-100 rounded-md min-h-24">
                  {JSON.stringify((existingRunFromThisService?.data as any)?.serviceData, null, 2)}
                </pre>
              </details>
            </React.Fragment>
          );
        })}
      </div>
    </PageFrame>
  );
}
