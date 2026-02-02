import { useCallback, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';

const SAVE_DEBOUNCE_MS = 400;

export function useSaveField(
  draftObjectId: string | null,
  fieldName: string,
  onDraftCreated: ((id: string) => void) | undefined,
) {
  const fetcher = useFetcher();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = (fetcher.data as { objectId?: string } | undefined)?.objectId;
    if (id && onDraftCreated) onDraftCreated(id);
  }, [fetcher.data, onDraftCreated]);

  const save = useCallback(
    (value: unknown) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const formData = new FormData();
        formData.set('intent', 'save-field');
        formData.set('fieldName', fieldName);
        formData.set('value', typeof value !== 'string' ? JSON.stringify(value) : value);
        if (draftObjectId) formData.set('objectId', draftObjectId);
        fetcher.submit(formData, { method: 'POST' });
      }, SAVE_DEBOUNCE_MS);
    },
    [draftObjectId, fieldName, fetcher],
  );

  return save;
}
