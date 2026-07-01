import { useRouteLoaderData } from 'react-router';
import { data, type ShouldRevalidateFunctionArgs } from 'react-router';
import {
  getBrandingFromMetaMatches,
  joinPageTitle,
  getExtensionCheckServicesFromServerConfig,
  useDeploymentConfig,
  scopes,
  type GeneralError,
} from '@curvenote/scms-core';
import type { MetaFunction } from 'react-router';
import type { WorkDTO } from '@curvenote/common';
import type { Workflow } from '@curvenote/scms-core';
import { withSecureWorkContext, works } from '@curvenote/scms-server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import type { Route } from './+types/route';
import { WorkVersionTimeline } from './WorkVersionTimeline';
import { WorkDetailsTopBar } from './WorkDetailsTopBar';
import { WorkDetailsContentCard } from './WorkDetailsContentCard';
import { SubmittedToBar } from './SubmittedToBar';
import type {
  SubmissionWithVersionsAndSite,
  WorkVersionContentCardData,
  WorkVersionForDetailsClient,
} from '../works.$workId/types';
import type { WorkActivityRow, CheckServiceRunRow } from '../works.$workId/db.server';
import type { LinkedJobsByWorkVersionId } from './types';
import { dbUpdateWorkDoi } from './db.server';
import { validateAndNormalizeDoi } from './doi.server';
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
  versions: WorkVersionForDetailsClient[];
  submissions: SubmissionWithVersionsAndSite[];
  linkedJobsByWorkVersionId: Promise<LinkedJobsByWorkVersionId>;
  workOwnerName: string | null;
  activities: WorkActivityRow[];
  checkServiceRunsByWorkVersionId: Record<string, CheckServiceRunRow[]>;
  canUpload: boolean;
  canResumeDraft: boolean;
  resumeDraftVersionId?: string;
  latestNonDraftContentCard: WorkVersionContentCardData | null;
  users: WorkUser[];
};

const DoiActionSchema = zfd.formData({
  intent: zfd.text(z.enum(['set-doi', 'clear-doi'])),
  doi: zfd.text(z.string().optional()),
});

export async function action(args: Route.ActionArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.id.update]);
  const formData = await args.request.formData();
  const parsed = DoiActionSchema.safeParse(formData);

  if (!parsed.success) {
    return data(
      { error: { type: 'general', message: 'Invalid form data' } as GeneralError },
      { status: 400 },
    );
  }

  const { intent, doi: rawDoi } = parsed.data;

  if (intent === 'clear-doi') {
    await dbUpdateWorkDoi(ctx.work.id, null);
    return { success: true, intent, doi: null };
  }

  if (intent === 'set-doi') {
    const raw = rawDoi?.trim() ?? '';
    const result = validateAndNormalizeDoi(raw);
    if (!result.ok) {
      return data(
        { error: { type: 'general', message: result.error } as GeneralError },
        { status: 400 },
      );
    }

    await dbUpdateWorkDoi(ctx.work.id, result.normalized);
    return { success: true, intent, doi: result.normalized };
  }

  return data(
    { error: { type: 'general', message: 'Unknown intent' } as GeneralError },
    { status: 400 },
  );
}

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const intent = formData?.get('intent');
  if (intent === 'set-doi' || intent === 'clear-doi') {
    return true;
  }
  return defaultShouldRevalidate;
}

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
    canResumeDraft,
    resumeDraftVersionId,
    latestNonDraftContentCard,
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
          uploadProps={{
            canUpload,
            workBasePath,
            canResumeDraft,
            resumeDraftVersionId,
          }}
        />
        <div className="space-y-1">
          <WorkDetailsContentCard version={latestNonDraftContentCard} />
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
