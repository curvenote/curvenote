import { useFetcher } from 'react-router';
import { useEffect, useRef } from 'react';
import type { GeneralError, WorkflowTransition } from '@curvenote/scms-core';
import type { sites } from '@curvenote/scms-server';

type SubmissionVersionItem = Awaited<ReturnType<typeof sites.submissions.versions.transition>>;

interface UseTransitionFetcherOptions {
  onTransitionSuccess?: (transition?: WorkflowTransition) => void;
  onTransitionError?: (error: GeneralError | string) => void;
}

interface UseTransitionFetcherReturn {
  fetcher: ReturnType<
    typeof useFetcher<{
      success?: boolean;
      item?: SubmissionVersionItem;
      error?: GeneralError | string;
    }>
  >;
  submitTransition: (submissionVersionId: string, status: string, action: string) => void;
  isTransitioning: boolean;
  hasError: boolean;
  error: GeneralError | string | null;
}

export function useTransitionFetcher({
  onTransitionSuccess,
  onTransitionError,
}: UseTransitionFetcherOptions = {}): UseTransitionFetcherReturn {
  const fetcher = useFetcher<{
    success?: boolean;
    item?: SubmissionVersionItem;
    error?: GeneralError | string;
  }>();

  // Use ref to avoid infinite loop in useEffect
  const onTransitionSuccessRef = useRef(onTransitionSuccess);
  const onTransitionErrorRef = useRef(onTransitionError);
  onTransitionSuccessRef.current = onTransitionSuccess;
  onTransitionErrorRef.current = onTransitionError;

  useEffect(() => {
    if (fetcher.data?.error) {
      onTransitionErrorRef.current?.(fetcher.data.error);
    } else if (fetcher.data?.item) {
      const transition = fetcher.data.item.transition as WorkflowTransition | undefined;
      onTransitionSuccessRef.current?.(transition);
    }
  }, [fetcher.data]);

  const submitTransition = (submissionVersionId: string, status: string, action: string) => {
    fetcher.submit({ submissionVersionId, status }, { method: 'POST', action });
  };

  return {
    fetcher,
    submitTransition,
    isTransitioning: fetcher.state !== 'idle',
    hasError: !!fetcher.data?.error,
    error: fetcher.data?.error || null,
  };
}
