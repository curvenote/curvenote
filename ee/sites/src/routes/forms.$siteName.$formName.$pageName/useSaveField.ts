import { useCallback, useEffect, useId, useRef } from 'react';
import { useFetcher } from 'react-router';
import { useReportFetcherState } from './formSyncContext.js';

const SAVE_DEBOUNCE_MS = 400;

/**
 * Hook that owns its fetcher: debounced save(value) builds FormData and submits.
 * When the action returns objectId, onDraftCreated is called.
 * Reports fetcher state to FormSyncContext so sidebar can show saving vs synced.
 */
export function useSaveField(
  draftObjectId: string | null,
  fieldName: string,
  onDraftCreated: ((id: string) => void) | undefined,
) {
  const id = useId();
  const fetcher = useFetcher();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useReportFetcherState(fetcher, `${id}-${fieldName}`);

  useEffect(() => {
    const objectId = (fetcher.data as { objectId?: string } | undefined)?.objectId;
    if (objectId && onDraftCreated) onDraftCreated(objectId);
  }, [fetcher.data, onDraftCreated]);

  const save = useCallback(
    (value: unknown) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const formData = new FormData();
        formData.set('intent', 'save-fields');
        formData.set('payload', JSON.stringify({ [fieldName]: value }));
        if (draftObjectId) formData.set('objectId', draftObjectId);
        fetcher.submit(formData, { method: 'POST' });
      }, SAVE_DEBOUNCE_MS);
    },
    [draftObjectId, fieldName, fetcher],
  );

  return save;
}
