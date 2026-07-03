import { resolveApiPath } from '../utils.server.js';

export const CRON_TICK_PATH = '/v1/cron/tick';

type CronTickApiConfig = {
  url: string;
  tasksCallbackUrl?: string;
  cron?: { tickUrl?: string };
};

/** Resolve POST /v1/cron/tick from an API base (origin or /v1 suffix). */
export function resolveCronTickUrl(apiUrl: string): string {
  return resolveApiPath(apiUrl, CRON_TICK_PATH);
}

/** URL Postgres should call — prefers tasksCallbackUrl for Docker dev setups. */
export function resolveStoredCronTickUrl(api: CronTickApiConfig): string {
  if (api.cron?.tickUrl) {
    return api.cron.tickUrl;
  }
  if (api.tasksCallbackUrl) {
    return resolveCronTickUrl(api.tasksCallbackUrl);
  }
  return resolveCronTickUrl(api.url);
}

function normalizeTickPathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return trimmed === '' ? '/' : trimmed;
}

function addAllowedHost(hosts: Set<string>, candidate: string | undefined): void {
  if (!candidate?.trim()) return;
  try {
    hosts.add(new URL(candidate.trim()).host);
  } catch {
    // ignore invalid config URLs
  }
}

/** Hosts (hostname:port) derived from app-config API bases — the only tick targets admins may set. */
export function collectAllowedCronTickHosts(api: CronTickApiConfig): Set<string> {
  const hosts = new Set<string>();
  addAllowedHost(hosts, api.url);
  addAllowedHost(hosts, api.tasksCallbackUrl);
  addAllowedHost(hosts, api.cron?.tickUrl);
  addAllowedHost(hosts, resolveStoredCronTickUrl(api));
  return hosts;
}

/**
 * Validate a cron tick URL before storing in `_CronTickConfig`.
 * Restricts host to app-config API bases and path to `/v1/cron/tick`.
 */
export function assertAllowedCronTickUrl(url: string, api: CronTickApiConfig): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Tick url must be a valid absolute URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Tick url must use http or https');
  }

  if (normalizeTickPathname(parsed.pathname) !== CRON_TICK_PATH) {
    throw new Error(`Tick url path must be ${CRON_TICK_PATH}`);
  }

  const allowedHosts = collectAllowedCronTickHosts(api);
  if (allowedHosts.size === 0) {
    throw new Error('No allowed tick hosts configured in app-config api.url');
  }

  if (!allowedHosts.has(parsed.host)) {
    throw new Error(
      `Tick url host must match app-config API host (${[...allowedHosts].join(', ')})`,
    );
  }

  return trimmed;
}
