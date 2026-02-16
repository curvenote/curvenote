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
  signFilesInMetadata,
  dbCreateDraftWorkVersion,
  userHasScope,
  works as worksLoaders,
} from '@curvenote/scms-server';
import {
  MainWrapper,
  SecondaryNav,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  getWorkflows,
  registerExtensionWorkflows,
  scopes,
} from '@curvenote/scms-core';
import { buildMenu } from './menu';
import {
  dbGetLinkedJobsByWorkVersionIds,
  dbGetWorkActivities,
  dbGetWorkOwnerName,
  dbGetWorkVersionsWithSubmissionVersions,
  dbDeleteDraftVersionOnWork,
} from './db.server';
import { WorkDetailsCard } from './WorkDetailsCard';
import { getUniqueSubmissions } from './utils.server';
import { extensions } from '../../../extensions/client';
import { exportToPdfAction } from './actionHelpers.server';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

const WorkActionIntentSchema = zfd.formData({
  intent: zfd.text(
    z.enum(['export-to-pdf', 'get-drafts-for-work', 'create-new-version', 'delete-draft']),
  ),
  workId: zfd.text(z.string().optional()),
});

/** Draft version is valid for resume if it has the checks field in metadata (same as My Works). */
function isDraftVersionValidForReuse(version: { metadata: unknown }): boolean {
  const meta = version.metadata as Record<string, unknown> | null;
  return Boolean(meta && 'checks' in meta);
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

  const { intent, workId: formWorkId } = parsed.data;
  const ctx = await withSecureWorkContext(args, [scopes.work.read]);

  if (intent === 'get-drafts-for-work') {
    const workVersions = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
    const latest = workVersions[0];
    const drafts =
      latest?.draft && isDraftVersionValidForReuse(latest)
        ? [
            {
              workId: ctx.work.id,
              workVersionId: latest.id,
              workTitle: latest.title || 'Untitled Work',
              dateModified: latest.date_modified,
              dateCreated: latest.date_created,
              metadata: latest.metadata,
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
      const workVersionsForTitle = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
      const latestNonDraft = workVersionsForTitle?.find((v) => !v.draft);
      const workTitle = latestNonDraft?.title ?? ctx.workDTO?.title ?? '';
      const result = await dbCreateDraftWorkVersion(ctx, ctx.work.id, 'work-details', workTitle);
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

  if (intent === 'export-to-pdf') {
    return exportToPdfAction(ctx, formData);
  }

  return data({ error: { type: 'general' as const, message: 'Unknown intent' } }, { status: 400 });
}

export const loader = async (args: LoaderFunctionArgs) => {
  const ctx = await withSecureWorkContext(args, [scopes.work.read]);

  const { workId } = args.params;
  if (!workId) return redirect('/app/works');

  const workVersions = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
  if (!workVersions) throw redirect('/app/works');

  const isDraftOnlyWork = workVersions.length > 0 && workVersions.every((v) => v.draft);

  const url = new URL(args.request.url);
  const pathname = url.pathname;
  const includeDraftSubmissions = url.searchParams.get('drafts') === 'true';

  // Draft-only works should route users into the upload flow, not the details pages.
  if (isDraftOnlyWork) {
    const isUploadPath = pathname.includes(`/app/works/${workId}/upload/`);
    const isDetailsLikePath =
      pathname === `/app/works/${workId}` ||
      pathname === `/app/works/${workId}/` ||
      pathname.startsWith(`/app/works/${workId}/details`) ||
      pathname.startsWith(`/app/works/${workId}/users`) ||
      pathname.startsWith(`/app/works/${workId}/work-integrity`) ||
      pathname.startsWith(`/app/works/${workId}/site/`);

    if (!isUploadPath && isDetailsLikePath) {
      throw redirect(`/app/works/${workId}/upload/${workVersions[0].id}`);
    }
  }

  // Default index redirect (preserve query string e.g. ?drafts=true).
  if (pathname === `/app/works/${workId}` || pathname === `/app/works/${workId}/`) {
    throw redirect(`/app/works/${workId}/details${url.search}`);
  }

  const submissions = getUniqueSubmissions(workVersions, {
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
    versionCount: workVersions.length,
    submissionCount: submissions.length,
    isDraft: workVersions.length === 1 && workVersions[0].draft,
  });

  await ctx.analytics.flush();

  const versionIds = workVersions.map((v) => v.id);

  // Sign file URLs for versions that have metadata.files (for download links on details page).
  const versionsWithSignedFileMetadata = await Promise.all(
    workVersions.map(async (v) => {
      const meta =
        v.metadata != null && typeof v.metadata === 'object'
          ? (v.metadata as Record<string, unknown>)
          : null;
      if (!meta?.files || typeof meta.files !== 'object') return v;
      const signed = await signFilesInMetadata(
        meta as Parameters<typeof signFilesInMetadata>[0],
        v.cdn ?? '',
        ctx,
      );
      return { ...v, metadata: signed };
    }),
  );

  const workOwnerName = await dbGetWorkOwnerName(ctx.work.id);
  const activities = await dbGetWorkActivities(ctx.work.id);
  const canUpload = userHasScope(ctx.user, scopes.app.works.upload);

  // Use latest non-draft work version for card and details metadata; fall back to ctx.workDTO if all are drafts
  const latestNonDraftVersion = versionsWithSignedFileMetadata.find((v) => !v.draft);
  const work = latestNonDraftVersion
    ? worksLoaders.formatWorkDTO(ctx, ctx.work, latestNonDraftVersion)
    : ctx.workDTO;

  return {
    userScopes: ctx.scopes,
    workflows,
    work,
    versions: versionsWithSignedFileMetadata,
    submissions: submissions ?? [],
    linkedJobsByWorkVersionId: dbGetLinkedJobsByWorkVersionIds(versionIds),
    workOwnerName,
    activities,
    canUpload,
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
  const { work, versions, submissions, userScopes } = loaderData;

  const isDrafting = versions.length > 0 && versions.every((v) => v.draft);
  const menu = buildMenu(`/app/works/${work.id}`, isDrafting, submissions, userScopes);

  return (
    <>
      {!isDrafting && (
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
      <MainWrapper hasSecondaryNav={!isDrafting}>
        <Outlet />
      </MainWrapper>
    </>
  );
}
