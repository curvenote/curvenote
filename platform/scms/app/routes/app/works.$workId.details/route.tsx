import { useRouteLoaderData } from 'react-router';
import {
  getBrandingFromMetaMatches,
  joinPageTitle,
  getExtensionCheckServicesFromServerConfig,
  useDeploymentConfig,
} from '@curvenote/scms-core';
import type { MetaFunction } from 'react-router';
import type { WorkDTO } from '@curvenote/common';
import type { Workflow } from '@curvenote/scms-core';
import { WorkVersionTimeline } from './WorkVersionTimeline';
import { WorkDetailsTopBar } from './WorkDetailsTopBar';
import { WorkDetailsContentCard } from './WorkDetailsContentCard';
import { SubmittedToBar } from './SubmittedToBar';
import type {
  SubmissionWithVersionsAndSite,
  WorkVersionWithSubmissionVersions,
} from '../works.$workId/types';
import type { WorkActivityRow, CheckServiceRunRow } from '../works.$workId/db.server';
import type { LinkedJobsByWorkVersionId } from './types';
import { extensions } from '../../../extensions/client';

type WorkUser = {
  id: string;
  display_name: string | null;
  email: string | null;
  work_roles: string[];
};

type LoaderData = {
  userScopes: string[];
  workflows: Record<string, Workflow>;
  work: WorkDTO;
  versions: WorkVersionWithSubmissionVersions[];
  submissions: SubmissionWithVersionsAndSite[];
  linkedJobsByWorkVersionId: Promise<LinkedJobsByWorkVersionId>;
  workOwnerName: string | null;
  activities: WorkActivityRow[];
  checkServiceRunsByWorkVersionId: Record<string, CheckServiceRunRow[]>;
  canUpload: boolean;
  users: WorkUser[];
};

export const meta: MetaFunction<() => LoaderData> = ({ matches, data }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle(data?.work?.title, 'Work Details', branding.title) }];
};

export default function WorkDetailRoute() {
  const {
    userScopes,
    workflows,
    work,
    versions,
    submissions,
    linkedJobsByWorkVersionId,
    workOwnerName,
    activities,
    checkServiceRunsByWorkVersionId,
    canUpload,
    users,
  } = useRouteLoaderData('routes/app/works.$workId/route') as LoaderData;

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
    { app: { extensions: extensionsConfig } } as unknown as Parameters<
      typeof getExtensionCheckServicesFromServerConfig
    >[0],
    extensions,
  );

  const workBasePath = `/app/works/${work.id}`;
  // Versions are ordered by date_modified desc; latest is first.
  const latestVersion = versions[0];

  // Prefer the latest non-draft work version for user-facing "Last updated" copy.
  const latestNonDraftWorkVersion = versions.find((v) => !v.draft);
  const lastUpdatedDate =
    latestNonDraftWorkVersion?.date_modified ?? versions[0]?.date_modified ?? undefined;

  const basePath = `/app/works/${work.id}`;

  return (
    <div
      className="relative w-full py-16 pr-4 xl:mt-0 xl:py-[56px] xl:pr-8 2xl:pr-16 xl:pl-10 2xl:pl-16 max-w-[1400px]"
      data-name="page-frame"
    >
      <div className="space-y-12">
        <WorkDetailsTopBar
          workId={work.id}
          users={users}
          uploadProps={{ canUpload, workBasePath, latestVersion }}
        />
        <div className="space-y-1">
          <WorkDetailsContentCard version={latestNonDraftWorkVersion ?? null} />
          <SubmittedToBar submissions={submissions} workflows={workflows} basePath={basePath} />
        </div>
        <div>
          <WorkVersionTimeline
            versions={versions}
            workflows={workflows}
            workOwnerName={workOwnerName}
            basePath={basePath}
            userScopes={userScopes}
            linkedJobsByWorkVersionId={linkedJobsByWorkVersionId}
            activities={activities}
            checkServiceRunsByWorkVersionId={checkServiceRunsByWorkVersionId}
            checkServices={checkServices}
          />
        </div>
      </div>
    </div>
  );
}
