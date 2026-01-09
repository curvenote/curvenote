import { expect } from 'vitest';
import type { JobsEndpointCall } from './mock-vercel';
import { getJobsEndpointCalls } from './mock-vercel';

export function verifyJobType(call: JobsEndpointCall, expectedType: string) {
  expect(call.payload.job_type).toBe(expectedType);
}

export function verifyJobSiteId(call: JobsEndpointCall, expectedSiteId: string) {
  expect(call.payload.payload.site_id).toBe(expectedSiteId);
}

export function verifyJobUserId(call: JobsEndpointCall, expectedUserId: string) {
  expect(call.payload.payload.user_id).toBe(expectedUserId);
}

export function verifyJobSubmissionVersionId(call: JobsEndpointCall, expectedVersionId: string) {
  expect(call.payload.payload.submission_version_id).toBe(expectedVersionId);
}

export function verifyJobCdn(call: JobsEndpointCall, expectedCdn: string) {
  expect(call.payload.payload.cdn).toBe(expectedCdn);
}

export function verifyJobKey(call: JobsEndpointCall, expectedKey: string) {
  expect(call.payload.payload.key).toBe(expectedKey);
}

export function verifyJobDatePublished(call: JobsEndpointCall, expectedDate: string | undefined) {
  expect(call.payload.payload.date_published).toBe(expectedDate);
}

export function verifyJobCall(params: {
  jobType: string;
  siteId: string;
  userId: string;
  submissionVersionId: string;
  cdn: string;
  key: string;
  datePublished?: string;
}) {
  const calls = getJobsEndpointCalls();
  expect(calls.length).toBeGreaterThan(0);

  const call = calls[0];
  verifyJobType(call, params.jobType);
  verifyJobSiteId(call, params.siteId);
  verifyJobUserId(call, params.userId);
  verifyJobSubmissionVersionId(call, params.submissionVersionId);
  verifyJobCdn(call, params.cdn);
  verifyJobKey(call, params.key);
  verifyJobDatePublished(call, params.datePublished);
}
