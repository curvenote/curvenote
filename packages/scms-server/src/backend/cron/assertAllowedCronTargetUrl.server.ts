import { collectAllowedCronTickHosts } from './resolveCronTickUrl.server.js';

type CronTargetApiConfig = Parameters<typeof collectAllowedCronTickHosts>[0];

/**
 * Restrict a cron job's `target_url` to our own API hosts. HANDSHAKE-authed
 * targets receive a live scoped bearer token minted for that request, so an
 * unrestricted target_url would let anyone able to create a cron job
 * exfiltrate that token to an arbitrary host.
 */
export function assertAllowedCronTargetUrl(url: string, api: CronTargetApiConfig): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Cron target_url must be a valid absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Cron target_url must use http or https');
  }
  const allowedHosts = collectAllowedCronTickHosts(api);
  if (!allowedHosts.has(parsed.host)) {
    throw new Error(
      `Cron target_url host must match our own API host (${[...allowedHosts].join(', ')})`,
    );
  }
  return url;
}
