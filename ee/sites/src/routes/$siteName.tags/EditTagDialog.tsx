import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { TAG_LABEL_MAX_LENGTH, ui } from '@curvenote/scms-core';
import type { TagCatalogRow } from './types.js';
import {
  getFetcherErrorParts,
  getTagDialogAlertError,
  getTagDialogIdleAction,
  getTagFormFieldError,
  getTagEditLabelError,
  isTagLabelDivergedFromName,
  resolveTagCatalogOutcome,
  type TagCatalogFetcherData,
} from './tags.utils.js';

type EditTagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: TagCatalogRow;
};

function TagNameDivergenceMessage({ name }: { name: string }) {
  return (
    <>
      This tag will keep the name <span className="font-mono">{name}</span>. To use a different
      name, create a new tag.
    </>
  );
}

export function EditTagDialog({ open, onOpenChange, tag }: EditTagDialogProps) {
  const fetcher = useFetcher<TagCatalogFetcherData>();
  const [label, setLabel] = useState(tag.label);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const prevFetcherState = useRef(fetcher.state);

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
  const labelDivergedFromName = isTagLabelDivergedFromName({ label, name: tag.name });
  const isSubmitting = fetcher.state !== 'idle';

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
    const nextError = getTagEditLabelError(label);
    if (nextError) {
      setLocalError(nextError);
      return;
    }
    setAwaitingResult(true);
    const formData = new FormData();
    formData.set('intent', 'update-tag');
    formData.set('tagId', tag.id);
    formData.set('label', label.trim());
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent>
        <ui.DialogHeader>
          <ui.DialogTitle>Edit tag</ui.DialogTitle>
          {labelDivergedFromName ? (
            <ui.DialogDescription className="sr-only">
              <TagNameDivergenceMessage name={tag.name} />
            </ui.DialogDescription>
          ) : (
            <ui.DialogDescription>
              Only the label can be changed; the name stays the same.
            </ui.DialogDescription>
          )}
        </ui.DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {labelDivergedFromName ? (
            <ui.SimpleAlert
              type="info"
              message={<TagNameDivergenceMessage name={tag.name} />}
              size="compact"
            />
          ) : null}
          {alertError ? <ui.SimpleAlert type="error" message={alertError} size="compact" /> : null}
          <ui.TextField
            id="edit-tag-label"
            label="Label"
            value={label}
            onChange={handleLabelChange}
            required
            maxLength={TAG_LABEL_MAX_LENGTH}
            error={fieldError}
            disabled={isSubmitting}
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Name</p>
            <p className="font-mono text-sm text-stone-500 dark:text-stone-400">{tag.name}</p>
          </div>
          <ui.DialogFooter>
            <ui.DialogClose asChild>
              <ui.Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </ui.Button>
            </ui.DialogClose>
            <ui.StatefulButton type="submit" busy={isSubmitting}>
              Save
            </ui.StatefulButton>
          </ui.DialogFooter>
        </form>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
