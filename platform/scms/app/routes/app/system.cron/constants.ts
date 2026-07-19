export const CRON_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type CronHttpMethod = (typeof CRON_HTTP_METHODS)[number];
