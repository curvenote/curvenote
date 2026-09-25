import { KnownJobTypes } from '@curvenote/scms-core';
import type { LinkedJobWithStatus } from '../works.$workId/db.server';

/** Job statuses that mean the conversion is waiting to start. */
export const WEB_CONVERSION_QUEUED = new Set(['QUEUED', 'SCHEDULED']);

/** Job statuses that mean the conversion is actively running. */
export const WEB_CONVERSION_RUNNING = new Set(['RUNNING']);

/** Job statuses that mean the latest attempt failed. */
export const WEB_CONVERSION_FAILED = new Set(['FAILED', 'CANCELLED']);

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

/** True when a linked job is a MyST → web site conversion. */
export function isMystCurvenoteWebJob(job: LinkedJobWithStatus): boolean {
  if (job.job_type !== KnownJobTypes.CONVERTER_TASK) return false;
  const payload = payloadRecord(job.payload);
  if (!payload) return false;
  if (payload.conversion_type === 'myst-curvenote-web') return true;
  return payload.target === 'web' && payload.conversion_type == null;
}

/**
 * Latest myst-curvenote-web converter job for a work version (by date_created desc).
 */
export function pickLatestWebConversionJob(
  jobs: LinkedJobWithStatus[],
): LinkedJobWithStatus | undefined {
  const webJobs = jobs.filter(isMystCurvenoteWebJob);
  if (webJobs.length === 0) return undefined;
  return [...webJobs].sort((a, b) => b.date_created.localeCompare(a.date_created))[0];
}

/** Best-effort error string from a failed/cancelled converter job. */
export function webConversionJobError(job: LinkedJobWithStatus): string | undefined {
  const messages = Array.isArray(job.messages) ? job.messages : [];
  const lastMessage =
    messages.length > 0 ? String(messages[messages.length - 1]).trim() : undefined;
  if (lastMessage) return lastMessage;

  const results = payloadRecord(job.results);
  const fromResults = results?.error;
  if (typeof fromResults === 'string' && fromResults.trim()) return fromResults.trim();

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
