/** Cron job target types (matches Prisma `CronJobTargetType`). */
export const CronJobTargetType = {
  HTTP: 'HTTP',
  JOB: 'JOB',
} as const;

export type CronJobTargetType = (typeof CronJobTargetType)[keyof typeof CronJobTargetType];
