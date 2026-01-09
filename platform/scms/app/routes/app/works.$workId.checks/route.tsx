import type { Route } from './+types/route';
import { data } from 'react-router';
import type React from 'react';
import { withSecureWorkContext, type WorkVersionMetadata } from '@curvenote/scms-server';
import type { FileMetadataSection } from '@curvenote/scms-core';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  httpError,
  scopes,
  getExtensionCheckServices,
  useDeploymentConfig,
} from '@curvenote/scms-core';
import { CurvenoteStructureChecksSection } from './CurvenoteStructureChecksSection';
import { formatWorkVersionDTO } from './db.server';
import type { ChecksMetadataSection } from '../works.$workId.upload.$workVersionId/checks.schema';
import { extensions } from '../../../extensions/client';

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

  return {
    work: ctx.workDTO,
    workVersion: workVersionDTO,
    metadata,
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
  const checkServices = getExtensionCheckServices(ctx.$config, extensions);
  for (const service of checkServices) {
    if (service.handleAction) {
      // Check if this service handles this intent
      // For now, we'll check if the intent starts with the service ID
      if (intent.startsWith(service.id) || intent.includes(service.id)) {
        try {
          return await service.handleAction({
            intent,
            formData,
            workVersionId: latestVersion.id,
            metadata,
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
  return [{ title: joinPageTitle('Checks', branding.title) }];
};

export default function ChecksPage({ loaderData }: Route.ComponentProps) {
  const { work, workVersion, metadata } = loaderData;

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
  const checkServices = getExtensionCheckServices(
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
    { label: 'Checks', isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Checks"
      subtitle="Run integrity checks on this work"
      breadcrumbs={breadcrumbs}
    >
      <div className="mt-4 space-y-6">
        {/* Always show core Curvenote structure checks */}
        <CurvenoteStructureChecksSection />
        {/* Dynamically render check sections from extensions */}
        {checkServices.map((service) => {
          const Component = service.checksSectionComponent as React.ComponentType<{
            metadata: WorkVersionMetadata & FileMetadataSection & ChecksMetadataSection;
          }>;
          return <Component key={service.id} metadata={metadata} />;
        })}
      </div>
    </PageFrame>
  );
}
