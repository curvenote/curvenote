export const KnownJobTypes = {
  CHECK: 'CHECK',
  CLI_CHECK: 'CLI_CHECK',
  PUBLISH: 'PUBLISH',
  UNPUBLISH: 'UNPUBLISH',
  CONVERTER_TASK: 'CONVERTER_TASK',
  /** Deposit one DoiDeposit's XML at Crossref. Handler registered by the sites extension (CN-2509). */
  CROSSREF_DEPOSIT: 'CROSSREF_DEPOSIT',
  /** Fetch a deposit's result from Crossref's submissionDownload. Handler registered by the sites extension (CN-2509). */
  CROSSREF_POLL: 'CROSSREF_POLL',
  /** Dispatch loopback test — handler simulates async work over ~8 seconds, updating status along the way. */
  LOOPBACK: 'LOOPBACK',
  /** Generic fallback when a job fails with no failure dependents or transport is exhausted. */
  JOB_FAILED_DEFAULT: 'JOB_FAILED_DEFAULT',
} as const;
