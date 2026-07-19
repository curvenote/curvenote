import { useSaveField as useCoreSaveField } from '@curvenote/scms-core';
import { useFormSyncContext } from './formSyncContext.js';

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
  const formSync = useFormSyncContext();
  return useCoreSaveField(draftObjectId, fieldName, onDraftCreated, {
    onFetcherStateChange: formSync?.reportFetcherState,
  });
}
