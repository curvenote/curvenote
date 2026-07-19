import { useCallback, useEffect, useId, useRef } from 'react';
import { useFetcher } from 'react-router';

const SAVE_DEBOUNCE_MS = 400;

export type SaveFieldOptions = {
  intent?: string;
  payloadFieldName?: string;
  method?: 'POST' | 'post';
  onFetcherStateChange?: (id: string, state: string) => void;
};

/**
 * Debounced field persistence helper for route actions that accept a JSON field payload.
 * The optional state reporter lets host routes connect the owned fetcher to local sync UI.
 */
export function useSaveField(
  draftObjectId: string | null,
  fieldName: string,
  onDraftCreated: ((id: string) => void) | undefined,
  {
    intent = 'save-fields',
    payloadFieldName = 'payload',
    method = 'POST',
    onFetcherStateChange,
  }: SaveFieldOptions = {},
) {
  const id = useId();
  const fetcher = useFetcher();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reporterId = `${id}-${fieldName}`;

  useEffect(() => {
    if (!onFetcherStateChange) return;
    onFetcherStateChange(reporterId, fetcher.state);
    return () => onFetcherStateChange(reporterId, 'idle');
  }, [fetcher.state, onFetcherStateChange, reporterId]);

  useEffect(() => {
    const objectId = (fetcher.data as { objectId?: string } | undefined)?.objectId;
    if (objectId && onDraftCreated) onDraftCreated(objectId);
  }, [fetcher.data, onDraftCreated]);

  const save = useCallback(
    (value: unknown) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const formData = new FormData();
        formData.set('intent', intent);
        formData.set(payloadFieldName, JSON.stringify({ [fieldName]: value }));
        if (draftObjectId) formData.set('objectId', draftObjectId);
        fetcher.submit(formData, { method });
      }, SAVE_DEBOUNCE_MS);
    },
    [draftObjectId, fetcher, fieldName, intent, method, payloadFieldName],
  );

  return save;
}
