import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { TAG_LABEL_MAX_LENGTH, ui } from '@curvenote/scms-core';
import {
  getCreateTagDuplicateError,
  getFetcherErrorParts,
  getTagDialogAlertError,
  getTagDialogIdleAction,
  getTagFormFieldError,
  getTagLabelValidationError,
  getTagNamePreview,
  resolveTagCatalogOutcome,
  type TagCatalogFetcherData,
} from './tags.utils.js';

type CreateTagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
};

export function CreateTagDialog({ open, onOpenChange, existingNames }: CreateTagDialogProps) {
  const fetcher = useFetcher<TagCatalogFetcherData>();
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const prevFetcherState = useRef(fetcher.state);

  const preview = getTagNamePreview(label);
  const parts = getFetcherErrorParts(fetcher.data);
  const fieldError = getTagFormFieldError({
    localError,
    fetcherError: parts.message,
    fetcherField: parts.field,
  });
  const alertError = getTagDialogAlertError({
    fetcherError: parts.message,
    fetcherField: parts.field,
  });
  const isSubmitting = fetcher.state !== 'idle';

  useEffect(() => {
    if (open) {
      setLabel('');
      setLocalError(undefined);
      setAwaitingResult(false);
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

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(event.target.value);
    setLocalError(undefined);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextError =
      getTagLabelValidationError(label) ?? getCreateTagDuplicateError({ label, existingNames });
    if (nextError) {
      setLocalError(nextError);
      return;
    }
    setAwaitingResult(true);
    const formData = new FormData();
    formData.set('intent', 'create-tag');
    formData.set('label', label.trim());
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent>
        <ui.DialogHeader>
          <ui.DialogTitle>New tag</ui.DialogTitle>
          <ui.DialogDescription>
            The label is the display name; the name is derived from it.
          </ui.DialogDescription>
        </ui.DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {alertError ? <ui.SimpleAlert type="error" message={alertError} size="compact" /> : null}
          <ui.TextField
            id="create-tag-label"
            label="Label"
            value={label}
            onChange={handleLabelChange}
            required
            maxLength={TAG_LABEL_MAX_LENGTH}
            error={fieldError}
            disabled={isSubmitting}
            autoFocus
          />
          <p className="font-mono text-sm text-stone-500 dark:text-stone-400">
            {preview.status === 'empty' ? 'Name' : preview.name}
          </p>
          <ui.DialogFooter>
            <ui.DialogClose asChild>
              <ui.Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </ui.Button>
            </ui.DialogClose>
            <ui.StatefulButton type="submit" busy={isSubmitting}>
              Create tag
            </ui.StatefulButton>
          </ui.DialogFooter>
        </form>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
