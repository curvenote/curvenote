/** Values of `DoiRegistration.status`. Stored as a string column, like `SubmissionVersion.status`. */
export const DOI_REGISTRATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTING: 'SUBMITTING',
  REGISTERED: 'REGISTERED',
  FAILED: 'FAILED',
} as const;

export type DoiRegistrationStatus =
  (typeof DOI_REGISTRATION_STATUS)[keyof typeof DOI_REGISTRATION_STATUS];

/** Values of `DoiDeposit.status`: one per deposit attempt. */
export const DOI_DEPOSIT_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;

export type DoiDepositStatus = (typeof DOI_DEPOSIT_STATUS)[keyof typeof DOI_DEPOSIT_STATUS];
