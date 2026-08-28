import { useFetcher } from 'react-router';
import { useState } from 'react';
import {
  type AttributeChangeFetcherOutcome,
  getFetcherIdleDialogAction,
} from './AttributeChangeDialog.utils.js';

type UseAttributeChangeDialogOptions<TData> = {
  resolveOutcome: (data: TData | undefined) => AttributeChangeFetcherOutcome;
};

type UseAttributeChangeDialogResult<TData> = {
  open: boolean;
  handleOpenChange: (nextOpen: boolean) => void;
  beginSubmit: () => void;
  fetcher: ReturnType<typeof useFetcher<TData>>;
};

export function useAttributeChangeDialog<TData>({
  resolveOutcome,
}: UseAttributeChangeDialogOptions<TData>): UseAttributeChangeDialogResult<TData> {
  const fetcher = useFetcher<TData>();
  const [open, setOpen] = useState(false);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const [prevFetcherState, setPrevFetcherState] = useState(fetcher.state);

  if (fetcher.state !== prevFetcherState) {
    const action = getFetcherIdleDialogAction(
      awaitingResult,
      prevFetcherState,
      fetcher.state,
      resolveOutcome(fetcher.data as TData | undefined),
    );

    setPrevFetcherState(fetcher.state);

    if (action?.closeDialog) {
      setOpen(false);
    }
    if (action?.clearAwaiting) {
      setAwaitingResult(false);
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAwaitingResult(false);
    }
  };

  const beginSubmit = () => {
    setAwaitingResult(true);
  };

  return {
    open,
    handleOpenChange,
    beginSubmit,
    fetcher,
  };
}
