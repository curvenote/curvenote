import { KnownJobTypes } from '@curvenote/scms-core';
import type { LinkedJobWithStatus } from '../works.$workId/db.server';

export {
  DEFAULT_WEB_CONVERSION_TYPE,
  findInFlightWebConversionJob,
  isWebConversionPayload,
  resolveRetryWebConversionTypeFromLinkedJobs,
  resolveWebConversionTypeForRetry,
  WEB_CONVERSION_TYPES,
} from '../works.$workId/webConversion.shared';

/** Job statuses that mean the conversion is waiting to start. */
export const WEB_CONVERSION_QUEUED = new Set(['QUEUED', 'SCHEDULED']);

/** Job statuses that mean the conversion is actively running. */
export const WEB_CONVERSION_RUNNING = new Set(['RUNNING']);

/** Job statuses that mean the latest attempt failed. */
export const WEB_CONVERSION_FAILED = new Set(['FAILED', 'CANCELLED']);

/** True when the server flagged this linked job as a web conversion (target=web). */
export function isWebConversionJob(job: LinkedJobWithStatus): boolean {
  return job.job_type === KnownJobTypes.CONVERTER_TASK && job.isWebConversion === true;
}

/**
 * Latest web-target converter job for a work version (by date_created desc).
 */
export function pickLatestWebConversionJob(
  jobs: LinkedJobWithStatus[],
): LinkedJobWithStatus | undefined {
  const webJobs = jobs.filter(isWebConversionJob);
  if (webJobs.length === 0) return undefined;
  return [...webJobs].sort((a, b) => b.date_created.localeCompare(a.date_created))[0];
}

/** Public error string for a failed/cancelled web conversion (sanitized on the server). */
export function webConversionJobError(job: LinkedJobWithStatus): string | undefined {
  if (typeof job.webError === 'string' && job.webError.trim()) return job.webError.trim();
  if (job.status === 'CANCELLED') return 'Web conversion was cancelled.';
  if (job.status === 'FAILED') return 'Web conversion failed.';
  return undefined;
}

export type WebConversionTimelinePhase = 'available' | 'queued' | 'building' | 'failed';

export type WebConversionTimelineModel = {
  phase: WebConversionTimelinePhase;
  error?: string;
  dateCreated: string;
  dateModified: string;
  /** Show Retry when the latest attempt failed (or was cancelled). */
  canRetry: boolean;
};

/**
 * Derive timeline UI state from work-version availability + latest web conversion job.
 * `available` means contains MYST (site build succeeded at least once).
 */
export function resolveWebConversionTimelineModel(opts: {
  available: boolean;
  versionDateCreated: string;
  versionDateModified: string;
  latestJob: LinkedJobWithStatus | undefined;
}): WebConversionTimelineModel | null {
  const { available, versionDateCreated, versionDateModified, latestJob } = opts;

  if (latestJob && WEB_CONVERSION_QUEUED.has(latestJob.status)) {
    return {
      phase: 'queued',
      dateCreated: latestJob.date_created,
      dateModified: latestJob.date_modified,
      canRetry: false,
    };
  }

  if (latestJob && WEB_CONVERSION_RUNNING.has(latestJob.status)) {
    return {
      phase: 'building',
      dateCreated: latestJob.date_created,
      dateModified: latestJob.date_modified,
      canRetry: false,
    };
  }

  if (latestJob && WEB_CONVERSION_FAILED.has(latestJob.status)) {
    return {
      phase: 'failed',
      error: webConversionJobError(latestJob),
      dateCreated: latestJob.date_created,
      dateModified: latestJob.date_modified,
      canRetry: true,
    };
  }

  if (available) {
    return {
      phase: 'available',
      dateCreated: versionDateModified || versionDateCreated,
      dateModified: versionDateModified,
      canRetry: false,
    };
  }

  return null;
}
