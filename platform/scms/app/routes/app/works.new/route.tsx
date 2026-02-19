import type { Route } from './+types/route';
import { withAppScopedContext, userHasScope } from '@curvenote/scms-server';
import {
  MainWrapper,
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
  ui,
  LoadingSpinner,
} from '@curvenote/scms-core';
import type { DraftWork } from '@curvenote/scms-core';
import { useEffect, useRef, useState } from 'react';
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from 'react-router';
import { redirect, useNavigate, useFetcher } from 'react-router';
import { getValidDraftWorksForUser } from '../works._index/getDrafts.server';

export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.works.upload]);
  const canUpload = userHasScope(ctx.user, scopes.app.works.upload);
  if (!canUpload) {
    throw redirect('/app/works');
  }
  const drafts = await getValidDraftWorksForUser(ctx.user.id);
  return { drafts, canUpload: true };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('New Work', branding.title) }];
};

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // Don't revalidate when the dialog fetcher runs (get/delete drafts). Otherwise we'd
  // refetch drafts, get [], and the no-drafts effect would create a new work and redirect.
  const intent = formData?.get('intent');
  if (intent === 'get-drafts' || intent === 'delete-draft' || intent === 'delete-all-drafts') {
    return false;
  }
  return defaultShouldRevalidate;
}

/** Response shape from POST /app/works when intent is create-new-draft */
type CreateNewDraftResponse = {
  intent?: string;
  success?: boolean;
  workId?: string;
  workVersionId?: string;
};

const INITIAL_PAUSE_MS = 500;

export default function NewWorkPage({ loaderData }: Route.ComponentProps) {
  const { drafts } = loaderData;
  const navigate = useNavigate();
  const fetcher = useFetcher<CreateNewDraftResponse>();
  const [isReady, setIsReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Brief centered loading pause to avoid flash before showing modal or redirecting
  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), INITIAL_PAUSE_MS);
    return () => clearTimeout(t);
  }, []);

  // Open the dialog once we're ready and there are drafts (stays open until user closes)
  useEffect(() => {
    if (isReady && drafts.length > 0) setDialogOpen(true);
  }, [isReady, drafts.length]);

  const uploadPath = (workId: string, workVersionId: string) =>
    `/app/works/${workId}/upload/${workVersionId}?from=new`;

  const handleResumeDraft = (draft: Pick<DraftWork, 'workId' | 'workVersionId'>) => {
    navigate(uploadPath(draft.workId, draft.workVersionId));
  };

  const handleCreateNew = () => {
    const formData = new FormData();
    formData.append('intent', 'create-new-draft');
    fetcher.submit(formData, { method: 'post', action: '/app/works' });
  };

  const hasSubmittedCreate = useRef(false);
  // When ready and there are no drafts, create one and redirect when done
  useEffect(() => {
    if (!isReady || drafts.length > 0 || hasSubmittedCreate.current) return;
    hasSubmittedCreate.current = true;
    const formData = new FormData();
    formData.append('intent', 'create-new-draft');
    fetcher.submit(formData, { method: 'post', action: '/app/works' });
  }, [isReady, drafts.length]);

  // Navigate when create-new-draft succeeds (no-drafts path or dialog "Create new")
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
        fetcher.data.workId &&
        fetcher.data.workVersionId
      ) {
        navigate(uploadPath(fetcher.data.workId, fetcher.data.workVersionId));
      }
    }
  }, [fetcher.state, fetcher.data, navigate]);

  const LoadingMessage = (
    <div className="flex flex-col justify-center items-center min-h-[40vh] gap-6 text-center">
      <LoadingSpinner size={40} color="text-blue-600" thickness={4} />
      <p className="text-lg font-medium text-foreground text-muted-foreground">Preparing</p>
      <p className="text-sm text-muted-foreground text-mono">
        You should be taken to the upload form in a moment.
      </p>
    </div>
  );

  // Initial pause: show centered loading to avoid flash, then one layout below
  if (!isReady) {
    return (
      <MainWrapper>
        <PageFrame className="mx-auto max-w-3xl h-screen">{LoadingMessage}</PageFrame>
      </MainWrapper>
    );
  }

  // Single render: minimal PageFrame, dialog open only when there are drafts
  return (
    <MainWrapper>
      <PageFrame className="mx-auto max-w-3xl"> </PageFrame>
      <ui.ResumeDraftWorkDialog<DraftWork>
        isOpen={dialogOpen}
        onClose={() => {
          navigate('/app/works');
          setDialogOpen(false);
        }}
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
          const fileCount = Object.keys((draft.metadata as any)?.files ?? {}).length;
          return fileCount > 0 ? (
            <div>{fileCount} file(s) uploaded</div>
          ) : (
            <div className="text-muted-foreground">No files uploaded yet</div>
          );
        }}
      />
    </MainWrapper>
  );
}
