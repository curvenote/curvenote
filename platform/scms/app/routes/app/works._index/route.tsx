import type { Route } from './+types/route';
import {
  dbCreateDraftFileWork,
  withAppScopedContext,
  userHasScope,
  withValidFormData,
} from '@curvenote/scms-server';
import {
  MainWrapper,
  PageFrame,
  FrameHeader,
  ui,
  getBrandingFromMetaMatches,
  joinPageTitle,
  getWorkflows,
  registerExtensionWorkflows,
  scopes,
} from '@curvenote/scms-core';
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from 'react-router';
import { useNavigate, data } from 'react-router';
import { PlusCircle } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { WorkList } from './WorkList';
import { dbGetWorksAndSubmissionVersions, dangerouslyDeleteDraftWork } from './db.server';
import {
  getValidDraftWorksForUser,
  isValidDraftForReuse,
} from './getDrafts.server';
import { dbFindDraftFileWorksForUser } from '../works.$workId.upload.$workVersionId/db.server';
import { extensions } from '../../../extensions/client';

// Action schema for handling draft work intents
const WorksActionSchema = zfd.formData({
  intent: zfd.text(z.enum(['get-drafts', 'delete-draft', 'delete-all-drafts', 'create-new-draft'])),
  workId: zfd.text(z.string().optional()),
});

type WorksActionPayload = z.infer<typeof WorksActionSchema>;

export const loader = async (args: LoaderFunctionArgs) => {
  const ctx = await withAppScopedContext(args, [scopes.work.list]); // app:works:feature
  try {
    // Create promise for deferred loading
    const worksPromise = dbGetWorksAndSubmissionVersions(ctx.user.id).then((items) => {
      const nonDraftItems = items.filter((item) => {
        const allVersionsAreDraft = item.versions.every((v) => v.draft);
        return !allVersionsAreDraft;
      });
      return nonDraftItems;
    });

    const workflows = getWorkflows(ctx.$config, registerExtensionWorkflows(extensions));

    const canUpload = userHasScope(ctx.user, scopes.app.works.upload);

    return {
      items: worksPromise,
      workflows,
      canUpload,
    };
  } catch {
    return {
      items: Promise.resolve([]),
      error: 'Error fetching works',
      workflows: getWorkflows(ctx.$config, registerExtensionWorkflows(extensions)),
    };
  }
};

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppScopedContext(args, [scopes.work.list, scopes.app.works.upload]);
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
        // Delete the draft work and its versions
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

    // Handle delete-all-drafts intent
    if (intent === 'delete-all-drafts') {
      try {
        const draftWorks = await dbFindDraftFileWorksForUser(ctx.user.id);
        const validDrafts = draftWorks.filter(isValidDraftForReuse);

        // Delete each draft
        const deleteResults = await Promise.allSettled(
          validDrafts.map((work) => dangerouslyDeleteDraftWork(ctx, work.id, ctx.user.id)),
        );

        // Count successes and failures
        const succeeded = deleteResults.filter((r) => r.status === 'fulfilled').length;
        const failed = deleteResults.filter((r) => r.status === 'rejected').length;

        if (failed > 0) {
          console.warn(`Failed to delete ${failed} out of ${validDrafts.length} drafts`);
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
      try {
        const newWork = await dbCreateDraftFileWork(ctx, 'my-works');
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

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('My Works', branding.title) }];
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
  const { items, workflows, error, canUpload } = loaderData;
  const navigate = useNavigate();

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
              title="My Works"
              subtitle="Manage your works and submissions"
              actionLabel="Create new work"
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
