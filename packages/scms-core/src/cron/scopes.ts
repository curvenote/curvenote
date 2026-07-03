/** Platform cron callback endpoint scopes ({METHOD}:{path}). */
export const CronEndpointScopes = {
  JOB_QUEUE_DRAIN: 'POST:/v1/jobs/push-to-drain',
  PROMOTE_SCHEDULED: 'POST:/v1/jobs/promote-scheduled',
} as const;

export type CronEndpointScope = (typeof CronEndpointScopes)[keyof typeof CronEndpointScopes];

export function cronEndpointScope(method: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${method.toUpperCase()}:${normalizedPath.split('?')[0]}`;
}
