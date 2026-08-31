import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { cn, ui } from '@curvenote/scms-core';
import type { TagCatalogRow } from './types.js';
import {
  getDeleteDialogAlertError,
  getFetcherErrorParts,
  getTagDeleteCopy,
  getTagDialogIdleAction,
  resolveTagCatalogOutcome,
  type TagCatalogFetcherData,
} from './tags.utils.js';

const DESTRUCTIVE_SOFT_BUTTON_CLASS = cn(
  'bg-destructive/10 text-red-800 shadow-xs hover:bg-destructive/15 hover:text-red-800 dark:bg-destructive/20 dark:text-red-300 dark:hover:bg-destructive/30 dark:hover:text-red-200',
);

type DeleteTagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: TagCatalogRow | null;
};

export function DeleteTagDialog({ open, onOpenChange, tag }: DeleteTagDialogProps) {
  const fetcher = useFetcher<TagCatalogFetcherData>({ key: `delete-tag:${tag?.id ?? 'none'}` });
  const [awaitingResult, setAwaitingResult] = useState(false);
  const [submittedThisOpen, setSubmittedThisOpen] = useState(false);
  const prevFetcherState = useRef(fetcher.state);
  const copy = getTagDeleteCopy(tag?.label ?? '');
  const isSubmitting = fetcher.state !== 'idle';
  const alertError = getDeleteDialogAlertError({
    submittedThisOpen,
    isSubmitting,
    fetcherMessage: getFetcherErrorParts(fetcher.data).message,
  });

  useEffect(() => {
    if (open) {
      setAwaitingResult(false);
      setSubmittedThisOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const action = getTagDialogIdleAction({
      awaitingResult,
      prevFetcherState: prevFetcherState.current,
      currentFetcherState: fetcher.state,
      outcome: resolveTagCatalogOutcome(fetcher.data),
    });
    prevFetcherState.current = fetcher.state;
    if (!action) {
      return;
    }
    if (action.clearAwaiting) {
      setAwaitingResult(false);
    }
    if (action.closeDialog) {
      onOpenChange(false);
    }
  }, [awaitingResult, fetcher.data, fetcher.state, onOpenChange]);

  const handleConfirm = () => {
    if (!tag) {
      return;
    }
    setSubmittedThisOpen(true);
    setAwaitingResult(true);
    const formData = new FormData();
    formData.set('intent', 'delete-tag');
    formData.set('tagId', tag.id);
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent>
        <ui.DialogHeader>
          <ui.DialogTitle>{copy.title}</ui.DialogTitle>
          <ui.DialogDescription>{copy.description}</ui.DialogDescription>
        </ui.DialogHeader>
        {alertError ? <ui.SimpleAlert type="error" message={alertError} size="compact" /> : null}
        <ui.DialogFooter>
          <ui.DialogClose asChild>
            <ui.Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </ui.Button>
          </ui.DialogClose>
          <ui.Button
            type="button"
            variant="ghost"
            className={DESTRUCTIVE_SOFT_BUTTON_CLASS}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? copy.submittingLabel : copy.confirmLabel}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
