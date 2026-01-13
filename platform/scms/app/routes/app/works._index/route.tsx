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
  ResumeDraftWorkDialog,
  getBrandingFromMetaMatches,
  joinPageTitle,
  getWorkflows,
  registerExtensionWorkflows,
  scopes,
} from '@curvenote/scms-core';
import type { DraftWork } from '@curvenote/scms-core';
import { useState, useEffect } from 'react';
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from 'react-router';
import { useNavigate, useFetcher, data } from 'react-router';
import { Upload } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { WorkList } from './WorkList';
import { dbGetWorksAndSubmissionVersions, dangerouslyDeleteDraftWork } from './db.server';
import { dbFindDraftFileWorksForUser } from '../works.$workId.upload.$workVersionId/db.server';
import { extensions } from '../../../extensions/client';

// Action schema for handling draft work intents
const WorksActionSchema = zfd.formData({
  intent: zfd.text(z.enum(['get-drafts', 'delete-draft', 'delete-all-drafts', 'create-new-draft'])),
  workId: zfd.text(z.string().optional()),
});

type WorksActionPayload = z.infer<typeof WorksActionSchema>;

/**
 * Check if a draft work is valid for reuse
 * Valid drafts must:
 * - Have exactly one work version
 * - Have the 'checks' field in metadata
 */
function isValidDraftForReuse(work: { versions: { metadata: any }[] }): boolean {
  // Must have exactly one version
  if (work.versions.length !== 1) {
    return false;
  }

  const metadata = work.versions[0].metadata as any;

  // Must have the checks field (even if empty)
  return metadata && 'checks' in metadata;
}

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
  const ctx = await withAppScopedContext(args, [scopes.work.list]);
  const formData = await args.request.formData();

  return withValidFormData(WorksActionSchema, formData, async (payload: WorksActionPayload) => {
    const { intent, workId } = payload;

    // Handle get-drafts intent
    if (intent === 'get-drafts') {
      const draftWorks = await dbFindDraftFileWorksForUser(ctx.user.id);

      // Filter to only valid drafts (single version with checks field)
      const validDrafts = draftWorks.filter(isValidDraftForReuse);

      const drafts = validDrafts.map((work) => ({
        workId: work.id,
        workVersionId: work.versions[0].id,
        workTitle: work.versions[0].title || 'Untitled Work',
        dateModified: work.date_modified,
        dateCreated: work.date_created,
        metadata: work.versions[0].metadata,
      }));
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
        // Get all valid drafts
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
  const fetcher = useFetcher<Route.ComponentProps['actionData']>();
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  // const [isCheckingDrafts, setIsCheckingDrafts] = useState(false);
  // const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  const handleUploadClick = () => {
    if (!canUpload) return;
    //
    // Check for existing drafts first
    // setIsCheckingDrafts(true);
    const formData = new FormData();
    formData.append('intent', 'get-drafts');

    fetcher.submit(formData, {
      method: 'post',
    });
  };

  // Handle the response from checking drafts
  useEffect(() => {
    if (
      fetcher.data &&
      'intent' in fetcher.data &&
      fetcher.data.intent === 'get-drafts' &&
      fetcher.state === 'idle'
    ) {
      if ('drafts' in fetcher.data && fetcher.data.drafts && fetcher.data.drafts.length > 0) {
        // Show resume dialog if drafts exist
        setShowResumeDialog(true);
      } else {
        // No drafts exist, create a new draft
        handleCreateNew();
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Handle the response from creating a new draft
  useEffect(() => {
    if (
      fetcher.data &&
      'intent' in fetcher.data &&
      fetcher.data.intent === 'create-new-draft' &&
      fetcher.state === 'idle'
    ) {
      if (
        'success' in fetcher.data &&
        fetcher.data.success &&
        'workId' in fetcher.data &&
        fetcher.data.workId &&
        'workVersionId' in fetcher.data &&
        fetcher.data.workVersionId
      ) {
        handleResumeDraft({
          workId: fetcher.data.workId,
          workVersionId: fetcher.data.workVersionId,
        });
      }
    }
  }, [fetcher.state, fetcher.data, navigate]);

  const handleResumeDraft = (draft: Pick<DraftWork, 'workId' | 'workVersionId'>) => {
    // Navigate to the specific work version
    navigate(`/app/works/${draft.workId}/upload/${draft.workVersionId}`);
  };

  const handleCreateNew = () => {
    // Create a new draft work via action
    const formData = new FormData();
    formData.append('intent', 'create-new-draft');
    fetcher.submit(formData, {
      method: 'post',
    });
  };

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
          title="My Works"
          subtitle="Manage your works and submissions"
          header={
            <FrameHeader
              className="max-w-4xl"
              title="My Works"
              subtitle="Manage your works and submissions"
              actionLabel={canUpload ? 'Upload Work' : undefined}
              actionIcon={canUpload ? <Upload className="w-4 h-4" /> : undefined}
              onAction={canUpload ? handleUploadClick : undefined}
            />
          }
          hasSecondaryNav={false}
          className="max-w-[1600px] space-y-16"
        >
          {worksList}
        </PageFrame>
      </MainWrapper>

      <ResumeDraftWorkDialog<DraftWork>
        isOpen={showResumeDialog}
        onClose={() => setShowResumeDialog(false)}
        onCreateNew={handleCreateNew}
        onResume={handleResumeDraft}
        fetchAction="/app/works"
        fetchIntent="get-drafts"
        deleteAction="/app/works"
        deleteIntent="delete-draft"
        title="Resume Previous Work"
        createButtonLabel="Create New Work"
        resumeButtonLabel="Resume uploading"
        renderItemDetails={(draft) => {
          const fileCount = Object.keys(draft.metadata?.files ?? {}).length;
          return fileCount > 0 ? (
            <div>{fileCount} file(s) uploaded</div>
          ) : (
            <div className="text-muted-foreground">No files uploaded yet</div>
          );
        }}
      />
    </>
  );
}
