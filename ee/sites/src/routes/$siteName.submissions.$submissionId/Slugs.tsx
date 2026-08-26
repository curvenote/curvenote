import { useFetcher } from 'react-router';
import { useState } from 'react';
import type { SlugsDTO } from './types.server.js';
import { DetailFieldEditorShell, DetailFieldEditorTrigger } from './DetailFieldEditor.js';
import { SlugManagerDialog } from './SlugManagerDialog.js';
import { ConfirmSlugActionDialog } from './ConfirmSlugActionDialog.js';
import {
  getDisplaySlug,
  getSlugAddFieldError,
  getSlugConfirmDialogError,
  getSuggestedSlugDraft,
  resolveSlugMutationOutcome,
  validateSlugForAdd,
  type SlugConfirmTarget,
} from './SlugManagerDialog.utils.js';
import { SUBMISSION_DETAIL_FORM_ACTIONS } from './SubmissionDetails.utils.js';

export function getSlugSuggestion(site: { name: string }, doi?: string) {
  const secondPartOfDoi = doi?.split('/')[1];
  return secondPartOfDoi ?? `${site.name}-`;
}

type SlugsProps = {
  siteId: string;
  submissionId: string;
  slugs: SlugsDTO;
  fallback: string;
  canEdit: boolean;
  baseUrl: string;
  suggestion?: string;
};

export function Slugs({
  siteId,
  submissionId,
  slugs,
  fallback,
  canEdit,
  suggestion,
  baseUrl,
}: SlugsProps) {
  const fetcher = useFetcher<{ error?: string; slugs?: SlugsDTO }>();
  const [managerOpen, setManagerOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<SlugConfirmTarget | null>(null);
  const [draftSlug, setDraftSlug] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();
  const [awaitingResult, setAwaitingResult] = useState(false);
  const [prevFetcherState, setPrevFetcherState] = useState(fetcher.state);

  if (fetcher.state !== prevFetcherState) {
    const outcome = resolveSlugMutationOutcome(fetcher.data);
    if (awaitingResult && prevFetcherState !== 'idle' && fetcher.state === 'idle') {
      if (outcome === 'success') {
        const updatedSlugs = fetcher.data?.slugs ?? slugs;
        setConfirmTarget(null);
        setDraftSlug(getSuggestedSlugDraft(suggestion, updatedSlugs) ?? '');
        setLocalError(undefined);
        setAwaitingResult(false);
      } else if (outcome === 'error') {
        setAwaitingResult(false);
      }
    }
    setPrevFetcherState(fetcher.state);
  }

  const displaySlug = getDisplaySlug(slugs, fallback);
  const isSubmitting = fetcher.state !== 'idle';
  const addSlugError = managerOpen
    ? getSlugAddFieldError({
        localError,
        fetcherFormData: fetcher.formData,
        fetcherError: fetcher.data?.error,
      })
    : undefined;
  const confirmError = getSlugConfirmDialogError({
    confirmTarget,
    fetcherFormData: fetcher.formData,
    fetcherError: fetcher.data?.error,
  });

  const handleDraftSlugChange = (value: string) => {
    setDraftSlug(value);
    if (localError) {
      setLocalError(undefined);
    }
  };

  const handleManagerOpenChange = (nextOpen: boolean) => {
    setManagerOpen(nextOpen);
    if (!nextOpen) {
      setConfirmTarget(null);
      setDraftSlug('');
      setLocalError(undefined);
      setAwaitingResult(false);
    }
  };

  const handleConfirmOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmTarget(null);
    }
  };

  const handleOpenManager = () => {
    setDraftSlug(getSuggestedSlugDraft(suggestion, slugs) ?? '');
    setLocalError(undefined);
    setManagerOpen(true);
  };

  const handleAdd = () => {
    const validationError = validateSlugForAdd(draftSlug, slugs);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(undefined);
    setAwaitingResult(true);
    fetcher.submit(
      {
        slug: draftSlug.trim(),
        formAction: SUBMISSION_DETAIL_FORM_ACTIONS.slugAdd,
        submission_id: submissionId,
        site_id: siteId,
      },
      { method: 'POST' },
    );
  };

  const handleConfirmAction = () => {
    if (!confirmTarget) {
      return;
    }

    setLocalError(undefined);
    setAwaitingResult(true);

    if (confirmTarget.action === 'remove') {
      fetcher.submit(
        {
          slug_id: confirmTarget.slugId,
          formAction: SUBMISSION_DETAIL_FORM_ACTIONS.slugRemove,
        },
        { method: 'POST' },
      );
      return;
    }

    fetcher.submit(
      {
        slug_id: confirmTarget.slugId,
        formAction: SUBMISSION_DETAIL_FORM_ACTIONS.slugSetPrimary,
      },
      { method: 'POST' },
    );
  };

  const handleRequestRemove = (slugId: string, slug: string) => {
    setConfirmTarget({ action: 'remove', slugId, slug });
  };

  const handleRequestSetPrimary = (slugId: string, slug: string) => {
    setConfirmTarget({ action: 'primary', slugId, slug });
  };

  return (
    <div className="w-full min-w-0">
      <DetailFieldEditorShell value={displaySlug}>
        {canEdit && <DetailFieldEditorTrigger title="Manage slugs" onClick={handleOpenManager} />}
      </DetailFieldEditorShell>
      {canEdit && (
        <>
          <SlugManagerDialog
            open={managerOpen}
            onOpenChange={handleManagerOpenChange}
            slugs={slugs}
            fallback={fallback}
            baseUrl={baseUrl}
            draftSlug={draftSlug}
            onDraftSlugChange={handleDraftSlugChange}
            addSlugError={addSlugError}
            isSubmitting={isSubmitting}
            onAdd={handleAdd}
            onRequestRemove={handleRequestRemove}
            onRequestSetPrimary={handleRequestSetPrimary}
          />
          {confirmTarget && (
            <ConfirmSlugActionDialog
              open
              onOpenChange={handleConfirmOpenChange}
              action={confirmTarget.action}
              slug={confirmTarget.slug}
              isSubmitting={isSubmitting}
              error={confirmError}
              onConfirm={handleConfirmAction}
            />
          )}
        </>
      )}
    </div>
  );
}
