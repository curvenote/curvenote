export const KnownJobTypes = {
  CHECK: 'CHECK',
  CLI_CHECK: 'CLI_CHECK',
  PUBLISH: 'PUBLISH',
  UNPUBLISH: 'UNPUBLISH',
  CONVERTER_TASK: 'CONVERTER_TASK',
  /** Dispatch loopback test — handler simulates async work over ~8 seconds, updating status along the way. */
  LOOPBACK: 'LOOPBACK',
  /** Generic fallback when a job fails with no failure dependents or transport is exhausted. */
  JOB_FAILED_DEFAULT: 'JOB_FAILED_DEFAULT',
} as const;
