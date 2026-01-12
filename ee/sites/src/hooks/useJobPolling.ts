import { useCallback } from 'react';
import { JobStatus } from '@prisma/client';
import { usePolling } from '@curvenote/scms-core';
import type { JobDTO } from '@curvenote/common';
import type { WorkflowTransition } from '@curvenote/scms-core';

interface UseJobPollingOptions {
  activeTransition: WorkflowTransition | null;
  onJobComplete: (job: JobDTO, targetStateName?: string) => void;
  onJobError: (error: Error) => void;
  pollingInterval?: number;
  numRetries?: number;
}

interface UseJobPollingReturn {
  isPolling: boolean;
  jobData: JobDTO | null;
  error: Error | null;
}

export function useJobPolling({
  activeTransition,
  onJobComplete,
  onJobError,
  pollingInterval = 1000,
  numRetries = 5,
}: UseJobPollingOptions): UseJobPollingReturn {
  const jobId = activeTransition?.state?.jobId;
  const shouldPoll = activeTransition?.requiresJob && jobId;

  const shouldStopPolling = useCallback((job: JobDTO) => {
    return job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED;
  }, []);

  const handleJobComplete = useCallback(
    (job: JobDTO) => {
      const targetStateName = activeTransition?.targetStateName;
      onJobComplete(job, targetStateName);
    },
    [activeTransition, onJobComplete],
  );

  const {
    data: jobData,
    isPolling,
    error,
  } = usePolling<JobDTO>({
    url: `/v1/jobs/${jobId}`,
    interval: pollingInterval,
    enabled: !!shouldPoll,
    numRetries,
    shouldStop: shouldStopPolling,
    onComplete: handleJobComplete,
    onError: onJobError,
  });

  return {
    isPolling,
    jobData,
    error,
  };
}
