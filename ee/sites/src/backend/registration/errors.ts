import { kindNotEligibleMessage } from '../deposit/mapper.js';
import type { DepositIssue } from '../deposit/types.js';

export type RegistrationFailure = {
  ok: false;
  status: 400 | 404 | 409 | 503;
  error: string;
  issues?: DepositIssue[];
};

function failure(status: RegistrationFailure['status'], error: string): RegistrationFailure {
  return { ok: false, status, error };
}

export const NOT_FOUND = failure(404, 'Submission not found.');
export const NOT_PUBLISHED = failure(409, 'Publish this submission to register a DOI.');
export const HAS_DOI = failure(409, 'This submission already has a DOI.');
export const NOT_ACTIVE = failure(409, 'The site is not set up for DOI registration.');
export const IN_PROGRESS = failure(409, 'A registration is already in progress.');
export const PREFIX_CHANGED = failure(409, "The site's DOI prefix changed. Try again.");
export const KIND_CHANGED = failure(
  409,
  "The Submission Kind's DOI content type changed. Try again.",
);
export const NOT_QUEUED = failure(503, 'The DOI registration could not be queued. Try again.');

export function kindNotEligible(kindTitle: string): RegistrationFailure {
  return failure(409, kindNotEligibleMessage(kindTitle));
}
