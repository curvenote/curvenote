import type { Route } from './+types/route';
import {
  dbCreateDraftFileWork,
  metadataForNewDraftFileWorkVersion,
  withAppScopedContext,
  userHasScope,
  withValidFormData,
} from '@curvenote/scms-server';
import {
  MainWrapper,
  PageFrame,
  FrameHeader,
  getBrandingFromMetaMatches,
  joinPageTitle,
  getWorkflows,
  registerExtensionWorkflows,
  scopes,
  capitalize,
  plural,
} from '@curvenote/scms-core';
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from 'react-router';
import { useNavigate, data } from 'react-router';
import { PlusCircle } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { WorkList } from './WorkList';
import { dbGetWorksAndSubmissionVersions, dangerouslyDeleteDraftWork } from './db.server';
import { getValidDraftWorksForUser } from './getDrafts.server';
import { extensions } from '../../../extensions/client';
import { extensions as serverExtensions } from '../../../extensions/server';

// Action schema for handling draft work intents
const WorksActionSchema = zfd.formData({
  intent: zfd.text(z.enum(['get-drafts', 'delete-draft', 'delete-all-drafts', 'create-new-draft'])),
  workId: zfd.text(z.string().optional()),
});

type WorksActionPayload = z.infer<typeof WorksActionSchema>;

export const loader = async (args: LoaderFunctionArgs) => {
  const ctx = await withAppScopedContext(args, [scopes.work.list], { redirect: true }); // app:works:feature
  try {
    // Create promise for deferred loading
    const worksPromise = dbGetWorksAndSubmissionVersions(ctx.user.id).then((items) => {
      const nonDraftItems = items.filter((item) => {
        const allVersionsAreDraft = item.versions.every((v) => v.draft);
        return !allVersionsAreDraft;
      });
      return nonDraftItems;
    });

    const stringReplacements = ctx.getStringReplacements();
    const workflows = getWorkflows(ctx.$config, registerExtensionWorkflows(extensions));

    const canUpload = userHasScope(ctx.user, scopes.app.works.upload);

    return {
      items: worksPromise,
      workflows,
      canUpload,
      stringReplacements,
    };
  } catch {
    return {
      items: Promise.resolve([]),
      error: 'Error fetching works',
      workflows: getWorkflows(ctx.$config, registerExtensionWorkflows(extensions)),
      stringReplacements: ctx.getStringReplacements(),
    };
  }
};

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.works.feature]);
  const formData = await args.request.formData();

  return withValidFormData(WorksActionSchema, formData, async (payload: WorksActionPayload) => {
    const { intent, workId } = payload;

    // Handle get-drafts intent
    if (intent === 'get-drafts') {
      const drafts = await getValidDraftWorksForUser(ctx.user.id);
      return { success: true, intent, drafts };
    }

    // Handle delete-draft intent
    if (intent === 'delete-draft') {
      if (!workId) {
        return data({ error: 'Work ID is required for delete operation' }, { status: 400 });
      }
      try {
        // Hard-delete this draft work and its versions. The action only gates on `app:works:feature`
        // (`withAppScopedContext` above); there is no separate `work:delete` (or per-work scope) check here.
        // Access control lives in `dangerouslyDeleteDraftWork`: the authed user must be OWNER on the work,
        // every version must still be a draft, and the work must have no submissions.
        await dangerouslyDeleteDraftWork(ctx, workId, ctx.user.id);
        return { success: true, intent };
      } catch (error) {
        console.error('Failed to delete draft work:', error);
        return data(
          {
            intent,
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete draft work',
          },
          { status: 500 },
        );
      }
    }

    // Handle delete-all-drafts intent (same list as the Resume-draft dialog: single-version drafts only)
    if (intent === 'delete-all-drafts') {
      // TODO: needs to be scoped to the work, all of them!
      // if (!userHasScope(ctx.user, scopes.work.delete)) {
      //   return data({ error: 'You do not have permission to delete drafts' }, { status: 403 });
      // }
      try {
        const validDrafts = await getValidDraftWorksForUser(ctx.user.id);

        // Delete each draft work
        const deleteResults = await Promise.allSettled(
          validDrafts.map((draft) => dangerouslyDeleteDraftWork(ctx, draft.workId, ctx.user.id)),
        );

        // Count successes and failures
        const succeeded = deleteResults.filter((r) => r.status === 'fulfilled').length;
        const failed = deleteResults.filter((r) => r.status === 'rejected').length;

        if (failed > 0) {
          console.warn(
            `Failed to delete ${failed} out of ${validDrafts.length} single-version drafts`,
          );
        }

        return {
          success: true,
          intent,
          deleted: succeeded,
          failed,
        };
      } catch (error) {
        console.error('Failed to delete all drafts:', error);
        return data(
          {
            success: false,
            intent,
            error: error instanceof Error ? error.message : 'Failed to delete all drafts',
          },
          { status: 500 },
        );
      }
    }

    // Handle create-new-draft intent
    if (intent === 'create-new-draft') {
      if (!userHasScope(ctx.user, scopes.work.create)) {
        return data({ error: 'You do not have permission to create drafts' }, { status: 403 });
      }
      try {
        const newWork = await dbCreateDraftFileWork(
          ctx,
          'my-works',
          [],
          metadataForNewDraftFileWorkVersion(ctx.$config, serverExtensions),
        );
        return {
          success: true,
          intent: 'create-new-draft',
          workId: newWork.id,
          workVersionId: newWork.versions[0].id,
        };
      } catch (error) {
        console.error('Failed to create new draft work:', error);
        return data(
          {
            success: false,
            intent,
            error: error instanceof Error ? error.message : 'Failed to create new draft work',
          },
          { status: 500 },
        );
      }
    }

    return data({ success: false, intent, error: 'Invalid intent' }, { status: 400 });
  });
}

export const meta: Route.MetaFunction = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  const workLabel = loaderData?.stringReplacements?.work ?? 'work';
  const worksTitle = capitalize(plural(`${workLabel}(s)`, 2));
  return [{ title: joinPageTitle(`My ${worksTitle}`, branding.title) }];
};

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // Don't revalidate for dialog-related actions
  const intent = formData?.get('intent');
  if (
    intent === 'get-drafts' ||
    intent === 'delete-draft' ||
    intent === 'delete-all-drafts' ||
    intent === 'create-new-draft'
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function MyWorks({ loaderData }: Route.ComponentProps) {
  const { items, workflows, error, canUpload, stringReplacements } = loaderData;
  const navigate = useNavigate();
  const workLabel = stringReplacements.work;
  const worksLabel = plural(`${workLabel}(s)`, 2);
  const worksTitle = capitalize(worksLabel);

  const worksList = (
    <div className="max-w-[900px]">
      {/* Works List Section without title when no tasks */}
      {error && <div className="p-2 my-2 text-red-600 bg-red-50">{error}</div>}
      {items && <WorkList items={items} workflows={workflows} />}
    </div>
  );

  return (
    <>
      <MainWrapper>
        <PageFrame
          header={
            <FrameHeader
              className="max-w-4xl"
              actionAlign="right"
              title={`My ${worksTitle}`}
              subtitle={`Manage your ${worksLabel}`}
              actionLabel={`Create new ${workLabel}`}
              actionIcon={<PlusCircle className="w-4 h-4" />}
              onAction={
                canUpload
                  ? () => navigate('/app/works/new')
                  : () => alert('For early access to upload features, please contact support')
              }
            />
          }
          hasSecondaryNav={false}
          className="max-w-[1600px] space-y-16"
        >
          {worksList}
        </PageFrame>
      </MainWrapper>
    </>
  );
}
