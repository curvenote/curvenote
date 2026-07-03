import type { CronJob } from '@curvenote/scms-db';

export type CronJobListRow = CronJob & {
  resolvedTargetUrl: string | null;
};
