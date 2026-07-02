import type { Route } from './+types/route';
import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';
import { Outlet } from 'react-router';
import {
  withSecureWorkContext,
  dbCreateDraftWorkVersion,
  metadataForNewDraftFileWorkVersion,
  userHasScope,
  works,
  getUserScopesSet,
  getPrismaClient,
  SiteContextWithUser,
  sites as siteLoaders,
} from '@curvenote/scms-server';
import {
  MainWrapper,
  SecondaryNav,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  getWorkflows,
  registerExtensionWorkflows,
  getExtensionCheckServicesFromServerConfig,
  loadCheckMaintenanceByServiceIds,
  CheckMaintenanceProvider,
  scopes,
  resolveCreateNewVersionOption,
  invokeExtensionCreateWorkVersion,
  BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
} from '@curvenote/scms-core';
import { buildMenu } from './menu';
import {
  dbAttachMetadataToWorkVersions,
  dbGetCheckServiceRunsByWorkVersionIds,
  dbGetLinkedJobsByWorkVersionIds,
  dbGetLatestWorkVersionForWork,
  dbGetWorkActivities,
  dbGetWorkOwnerName,
  dbGetWorkVersionsWithSubmissionVersions,
  dbDeleteDraftVersionOnWork,
} from './db.server';
import { dbGetWorkUsers, dtoWorkUsers } from '../works.$workId.users/db.server';
import { WorkDetailsCard } from './WorkDetailsCard';
import { getUniqueSubmissions } from './utils.server';
import {
  computeCanResumeDraftUpload,
  getLicenseDisplayFromMetadata,
  isDraftVersionValidForReuse,
  resolveWorkVersionDoi,
  signVersionFilesForClient,
} from './metadata.server';
import type { WorkVersionContentCardData, WorkVersionForDetailsClient } from './types';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';
import { exportToPdfAction } from './actionHelpers.server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

const WorkActionIntentSchema = zfd.formData({
  intent: zfd.text(
    z.enum([
      'export-to-pdf',
      'get-drafts-for-work',
      'create-new-version',
      'delete-draft',
      'submit-to-site',
    ]),
  ),
  workId: zfd.text(z.string().optional()),
  siteName: zfd.text(z.string().optional()),
  workVersionId: zfd.text(z.string().optional()),
});

type SubmitTargetSite = {
  name: string;
  external: boolean;
  private: boolean;
  restricted: boolean;
};

function canUserSubmitToSite(
  user: Parameters<typeof userHasScope>[0],
  site: SubmitTargetSite,
): boolean {
  if (!site.private && !site.restricted) return true;
  return userHasScope(user, scopes.site.submissions.create, site.name);
}

export async function action(args: ActionFunctionArgs) {
  const formData = await args.request.formData();
  const parsed = WorkActionIntentSchema.safeParse(formData);
  if (!parsed.success) {
    return data(
      { error: { type: 'general' as const, message: 'Invalid form data' } },
      { status: 400 },
    );
  }

  const { intent, workId: formWorkId, siteName, workVersionId } = parsed.data;
  const ctx = await withSecureWorkContext(args, [scopes.work.id.read]);

  if (intent === 'get-drafts-for-work') {
    const latest = await dbGetLatestWorkVersionForWork(ctx.work.id);
    const drafts =
      latest?.draft && isDraftVersionValidForReuse(latest.metadata)
        ? [
            {
              workId: ctx.work.id,
              workVersionId: latest.id,
              workTitle: latest.title || 'Untitled Work',
              dateModified: latest.date_modified,
              dateCreated: latest.date_created,
            },
          ]
        : [];
    return { success: true, intent, drafts };
  }

  if (intent === 'create-new-version') {
    if (!userHasScope(ctx.user, scopes.app.works.upload)) {
      return data({ success: false, intent, error: 'Upload scope required' }, { status: 403 });
    }
    try {
      const latestNonDraft = ctx.work.versions?.find((v) => !v.draft);
      const [latestNonDraftWithMetadata] = latestNonDraft
        ? await dbAttachMetadataToWorkVersions([latestNonDraft])
        : [];
      const workTitle = latestNonDraft?.title ?? ctx.workDTO?.title ?? '';
      const sourceMetadata = (latestNonDraftWithMetadata?.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const userScopes = Array.from(getUserScopesSet(ctx.user));
      const extensionConfigs = Object.fromEntries(
        Object.entries(ctx.$config?.app?.extensions ?? {}).map(([key, value]) => [
          key,
          { routes: value?.routes ?? false },
        ]),
      );
      const resolved = resolveCreateNewVersionOption(
        sourceMetadata,
        extensionConfigs,
        serverExtensions,
        userScopes,
      );
      if (!resolved.ok) {
        return data({ success: false, intent, error: resolved.error }, { status: resolved.status });
      }
      const resolvedOption = resolved.option;

      if (resolvedOption.extensionId) {
        const extResult = await invokeExtensionCreateWorkVersion(
          serverExtensions,
          resolvedOption.extensionId,
          {
            ctx,
            workId: ctx.work.id,
            sourceVersionMetadata: sourceMetadata,
            defaultTitle: workTitle,
          },
        );
        if (!extResult) {
          return data(
            {
              success: false,
              intent,
              error: `No handler registered for create option "${resolvedOption.id}"`,
            },
            { status: 500 },
          );
        }
        if (!extResult.success) {
          return data(
            {
              success: false,
              intent,
              error: extResult.error ?? 'Failed to create new version',
            },
            { status: 500 },
          );
        }
        return {
          success: true,
          intent: 'create-new-version',
          workId: ctx.work.id,
          workVersionId: extResult.workVersionId,
          redirectPath: extResult.redirectPath,
        };
      }

      if (resolvedOption.id !== BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID) {
        return data(
          {
            success: false,
            intent,
            error: `Unsupported create option "${resolvedOption.id}"`,
          },
          { status: 500 },
        );
      }

      const result = await dbCreateDraftWorkVersion(
        ctx,
        ctx.work.id,
        'work-details',
        workTitle,
        metadataForNewDraftFileWorkVersion(),
      );
      return {
        success: true,
        intent: 'create-new-version',
        workId: result.workId,
        workVersionId: result.workVersionId,
      };
    } catch (error) {
      console.error('Failed to create new draft version:', error);
      return data(
        {
          success: false,
          intent,
          error: error instanceof Error ? error.message : 'Failed to create new version',
        },
        { status: 500 },
      );
    }
  }

  if (intent === 'delete-draft') {
    if (formWorkId && formWorkId !== ctx.work.id) {
      return data({ success: false, intent, error: 'Work ID mismatch' }, { status: 400 });
    }
    try {
      const result = await dbDeleteDraftVersionOnWork(ctx, ctx.work.id);
      if (!result.deleted) {
        return data(
          { success: false, intent, error: result.error ?? 'Could not delete draft' },
          { status: 400 },
        );
      }
      return { success: true, intent };
    } catch (error) {
      console.error('Failed to delete draft version:', error);
      return data(
        {
          success: false,
          intent,
          error: error instanceof Error ? error.message : 'Failed to delete draft version',
        },
        { status: 500 },
      );
    }
  }

  if (intent === 'submit-to-site') {
    if (!userHasScope(ctx.user, scopes.app.works.submitToSite)) {
      return data(
        { success: false, intent, error: 'Submit to site scope required' },
        { status: 403 },
      );
    }
    if (!siteName) {
      return data({ success: false, intent, error: 'Site is required' }, { status: 400 });
    }

    try {
      const prisma = await getPrismaClient();
      const site = await prisma.site.findUnique({
        where: { name: siteName },
        include: {
          domains: true,
          submissionKinds: true,
          collections: {
            orderBy: [{ default: 'desc' }, { date_created: 'desc' }],
            include: { kindsInCollection: { include: { kind: true } } },
          },
        },
      });
      if (!site) {
        return data(
          { success: false, intent, error: 'Selected site does not exist' },
          { status: 400 },
        );
      }
      if (!canUserSubmitToSite(ctx.user, site)) {
        return data(
          { success: false, intent, error: 'You do not have permission to submit to this site' },
          { status: 403 },
        );
      }

      const existingSubmission = await prisma.submission.findFirst({
        where: { work_id: ctx.work.id, site_id: site.id },
        include: { versions: { orderBy: { date_created: 'desc' }, take: 1 } },
      });

      const selectedVersion = workVersionId
        ? await prisma.workVersion.findFirst({
            where: { id: workVersionId, work_id: ctx.work.id, draft: false },
            select: { id: true },
          })
        : await prisma.workVersion.findFirst({
            where: { work_id: ctx.work.id, draft: false },
            orderBy: { date_created: 'desc' },
            select: { id: true },
          });
      if (!selectedVersion) {
        return data(
          { success: false, intent, error: 'No completed work version is available to submit' },
          { status: 400 },
        );
      }

      const siteCtx = new SiteContextWithUser(ctx, site);
      const existingVersion = existingSubmission?.versions[0];
      if (existingSubmission) {
        if (existingVersion?.work_version_id === selectedVersion.id) {
          return {
            success: true,
            intent,
            siteName,
            submissionVersionId: existingVersion.id,
            alreadySubmitted: true,
          };
        }
        const submissionVersion = await siteLoaders.submissions.versions.create(
          siteCtx,
          serverExtensions,
          existingSubmission.id,
          selectedVersion.id,
        );
        return {
          success: true,
          intent,
          siteName,
          submissionVersionId: submissionVersion.id,
        };
      }

      const collection =
        site.collections.find((item) => item.default && item.open) ??
        site.collections.find((item) => item.open);
      if (!collection) {
        return data(
          { success: false, intent, error: 'Selected site has no open collection' },
          { status: 400 },
        );
      }

      const collectionKinds = collection.kindsInCollection.map((item) => item.kind);
      const kind =
        collectionKinds.find((item) => item.default) ??
        collectionKinds[0] ??
        site.submissionKinds.find((item) => item.default) ??
        site.submissionKinds[0];
      if (!kind) {
        return data(
          { success: false, intent, error: 'Selected site has no submission kind' },
          { status: 400 },
        );
      }

      const submission = await siteLoaders.submissions.create(
        siteCtx,
        serverExtensions,
        selectedVersion.id,
        kind.id,
        false,
        undefined,
        collection.id,
      );
      return {
        success: true,
        intent,
        siteName,
        submissionVersionId: submission.versions[0]?.id,
      };
    } catch (error) {
      console.error('Failed to submit work to site:', error);
      return data(
        {
          success: false,
          intent,
          error: error instanceof Error ? error.message : 'Failed to submit work to site',
        },
        { status: 500 },
      );
    }
  }

  if (intent === 'export-to-pdf') {
    return exportToPdfAction(ctx, formData);
  }

  return data({ error: { type: 'general' as const, message: 'Unknown intent' } }, { status: 400 });
}

export const loader = async (args: LoaderFunctionArgs) => {
  const ctx = await withSecureWorkContext(args, [scopes.work.id.read]);

  const { workId } = args.params;
  if (!workId) return redirect('/app/works');

  const workVersions = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
  if (!workVersions) throw redirect('/app/works');

  const workVersionsWithMetadata = await dbAttachMetadataToWorkVersions(workVersions);

  const isDraftOnlyWork =
    workVersionsWithMetadata.length > 0 && workVersionsWithMetadata.every((v) => v.draft);

  const url = new URL(args.request.url);
  const pathname = url.pathname;
  const isOnUploadRoute = pathname.includes(`/app/works/${workId}/upload/`);
  const includeDraftSubmissions = url.searchParams.get('drafts') === 'true';

  // Draft-only works should route users into the upload flow, not the details pages.
  if (isDraftOnlyWork) {
    const isPmcDepositPath = pathname.startsWith(`/app/works/${workId}/site/pmc/`);
    const isDetailsLikePath =
      pathname === `/app/works/${workId}` ||
      pathname === `/app/works/${workId}/` ||
      pathname.startsWith(`/app/works/${workId}/details`) ||
      pathname.startsWith(`/app/works/${workId}/users`) ||
      pathname.startsWith(`/app/works/${workId}/work-integrity`) ||
      pathname.startsWith(`/app/works/${workId}/site/`);

    if (!isOnUploadRoute && isDetailsLikePath && !isPmcDepositPath) {
      throw redirect(`/app/works/${workId}/upload/${workVersionsWithMetadata[0].id}`);
    }
  }

  // Default index redirect (preserve query string e.g. ?drafts=true).
  if (pathname === `/app/works/${workId}` || pathname === `/app/works/${workId}/`) {
    throw redirect(`/app/works/${workId}/details${url.search}`);
  }

  const submissions = getUniqueSubmissions(workVersionsWithMetadata, {
    includeDrafts: includeDraftSubmissions,
  });
  const workflowNames = submissions.map((s) => s.collection.workflow);

  // TODO we could filter workflows based on the work versions
  const workflows = Object.fromEntries(
    Object.entries(getWorkflows(ctx.$config, registerExtensionWorkflows(extensions))).filter(
      ([name]) => workflowNames.includes(name),
    ),
  );

  await ctx.trackEvent(TrackEvent.WORK_VIEWED, {
    workId: ctx.work.id,
    workTitle: ctx.workDTO.title,
    versionCount: workVersionsWithMetadata.length,
    submissionCount: submissions.length,
    isDraft: workVersionsWithMetadata.length === 1 && workVersionsWithMetadata[0].draft,
  });

  await ctx.analytics.flush();

  const versionIds = workVersionsWithMetadata.map((v) => v.id);
  const canUpload = userHasScope(ctx.user, scopes.app.works.upload);
  const canSubmitToSite = userHasScope(ctx.user, scopes.app.works.submitToSite);

  const latestVersion = workVersionsWithMetadata[0];
  const latestNonDraftWithMetadata = workVersionsWithMetadata.find((v) => !v.draft);

  const canResumeDraft = computeCanResumeDraftUpload(
    canUpload,
    latestVersion,
    latestVersion?.metadata,
  );
  const resumeDraftVersionId = canResumeDraft ? latestVersion?.id : undefined;

  const latestNonDraftContentCard: WorkVersionContentCardData | null = latestNonDraftWithMetadata
    ? {
        title: latestNonDraftWithMetadata.title,
        authors: latestNonDraftWithMetadata.authors,
        author_details: latestNonDraftWithMetadata.author_details,
        doi: resolveWorkVersionDoi(latestNonDraftWithMetadata.doi, ctx.work.doi),
        license: getLicenseDisplayFromMetadata(latestNonDraftWithMetadata.metadata),
      }
    : null;

  // Sign file URLs for versions that have metadata.files (timeline download links only).
  const versionsForClient: WorkVersionForDetailsClient[] = await Promise.all(
    workVersionsWithMetadata.map(async (version) => {
      const { metadata, ...rest } = version;
      const fileMetadata = await signVersionFilesForClient(version, metadata, ctx);
      return fileMetadata ? { ...rest, metadata: fileMetadata } : rest;
    }),
  );

  const workOwnerName = await dbGetWorkOwnerName(ctx.work.id);
  const activities = await dbGetWorkActivities(ctx.work.id);
  const checkServiceRunsByWorkVersionId = await dbGetCheckServiceRunsByWorkVersionIds(versionIds);

  const work = latestNonDraftWithMetadata
    ? works.formatWorkDTO(ctx, ctx.work, latestNonDraftWithMetadata)
    : ctx.workDTO;
  const usersDbo = await dbGetWorkUsers(ctx.work.id);
  const users = usersDbo ? dtoWorkUsers(usersDbo) : [];

  const checkServices = getExtensionCheckServicesFromServerConfig(ctx.$config, serverExtensions);
  const maintenanceByServiceId = await loadCheckMaintenanceByServiceIds(
    ctx,
    serverExtensions,
    checkServices.map((service) => service.id),
  );
  const availableSites = canSubmitToSite
    ? (
        await (
          await getPrismaClient()
        ).site.findMany({
          orderBy: [{ external: 'desc' }, { title: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            title: true,
            description: true,
            metadata: true,
            external: true,
            private: true,
            restricted: true,
          },
        })
      )
        .filter((site) => canUserSubmitToSite(ctx.user, site))
        .map((site) => ({
          id: site.id,
          name: site.name,
          title: site.title,
          description: site.description,
          metadata: site.metadata,
          external: site.external,
        }))
    : [];

  return {
    userScopes: ctx.scopes,
    workflows,
    work,
    versions: versionsForClient,
    submissions: submissions ?? [],
    linkedJobsByWorkVersionId: dbGetLinkedJobsByWorkVersionIds(versionIds),
    workOwnerName,
    activities,
    checkServiceRunsByWorkVersionId,
    canUpload,
    canResumeDraft,
    resumeDraftVersionId,
    latestNonDraftContentCard,
    users,
    canSubmitToSite,
    availableSites,
    isOnUploadRoute,
    maintenanceByServiceId,
  };
};

export const meta: Route.MetaFunction = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle(loaderData?.work?.title, 'Work Details', branding.title) }];
};

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const intent = formData?.get('intent');
  if (
    intent === 'get-drafts-for-work' ||
    intent === 'create-new-version' ||
    intent === 'delete-draft'
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function WorkLayout({ loaderData }: Route.ComponentProps) {
  const { work, versions, submissions, userScopes, isOnUploadRoute, maintenanceByServiceId } =
    loaderData;

  const isDrafting = versions.length > 0 && versions.every((v) => v.draft);
  const showSecondaryNav = !isDrafting && !isOnUploadRoute;
  const menu = buildMenu(`/app/works/${work.id}`, isDrafting, submissions, userScopes);

  return (
    <CheckMaintenanceProvider maintenanceByServiceId={maintenanceByServiceId}>
      <>
        {showSecondaryNav && (
          <SecondaryNav
            contents={menu}
            title={isDrafting ? 'Work Details' : undefined}
            extensions={extensions}
            detailsCard={
              !isDrafting ? (
                <WorkDetailsCard
                  title={work.title ?? ''}
                  authors={work.authors}
                  thumbnail={work.links.thumbnail}
                />
              ) : undefined
            }
          />
        )}
        <MainWrapper hasSecondaryNav={showSecondaryNav}>
          <Outlet />
        </MainWrapper>
      </>
    </CheckMaintenanceProvider>
  );
}
