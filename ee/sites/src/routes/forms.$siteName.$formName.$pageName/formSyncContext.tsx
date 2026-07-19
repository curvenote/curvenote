import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type FormSyncContextValue = {
  reportFetcherState: (id: string, state: string) => void;
  isSaving: boolean;
};

const FormSyncContext = createContext<FormSyncContextValue | null>(null);

export function FormSyncProvider({ children }: { children: React.ReactNode }) {
  const [fetcherStates, setFetcherStates] = useState<Record<string, string>>({});

  const reportFetcherState = useCallback((id: string, state: string) => {
    setFetcherStates((prev) => {
      if (prev[id] === state) return prev;
      const next = { ...prev };
      if (state === 'idle') {
        delete next[id];
      } else {
        next[id] = state;
      }
      return next;
    });
  }, []);

  const isSaving = useMemo(
    () => Object.values(fetcherStates).some((s) => s !== 'idle'),
    [fetcherStates],
  );

  const value = useMemo<FormSyncContextValue>(
    () => ({ reportFetcherState, isSaving }),
    [reportFetcherState, isSaving],
  );

  return <FormSyncContext.Provider value={value}>{children}</FormSyncContext.Provider>;
}

export function useFormSyncContext(): FormSyncContextValue | null {
  return useContext(FormSyncContext);
}
