/** Resolve POST /v1/cron/tick from an API base (origin or /v1 suffix). */
export function resolveCronTickUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, '').replace(/(?:\/v1)+$/, '');
  return `${base}/v1/cron/tick`;
}

/** URL Postgres should call — prefers tasksCallbackUrl for Docker dev setups. */
export function resolveStoredCronTickUrl(api: {
  url: string;
  tasksCallbackUrl?: string;
  cron?: { tickUrl?: string };
}): string {
  if (api.cron?.tickUrl) {
    return api.cron.tickUrl;
  }
  if (api.tasksCallbackUrl) {
    return resolveCronTickUrl(api.tasksCallbackUrl);
  }
  return resolveCronTickUrl(api.url);
}
