/** Strip trailing slashes and any trailing `/v1` suffix from an API base, then append `path`. */
export function resolveApiPath(apiUrl: string, path: string): string {
  const base = apiUrl.replace(/\/+$/, '').replace(/(?:\/v1)+$/, '');
  return `${base}${path}`;
}

export type SecretUrlConfigStatus = {
  configured: boolean;
  url: string | null;
  defaultUrl: string;
  hasSecret: boolean;
  secretLength: number;
  appConfigSecretLength: number;
  secretMatchesAppConfig: boolean;
};

/**
 * Shape the common status for a singleton url+secret config row (e.g.
 * `_CronTickConfig`, `_JobQueueDrainConfig`): whether it's populated, and
 * whether its stored secret matches the app-config secret it should mirror.
 */
export function buildSecretUrlConfigStatus(
  row: { url: string; secret: string } | null,
  defaultUrl: string,
  appSecret: string,
): SecretUrlConfigStatus {
  const url = row?.url ?? null;
  const storedSecret = row?.secret ?? '';
  return {
    configured: Boolean(url && storedSecret),
    url,
    defaultUrl,
    hasSecret: storedSecret.length > 0,
    secretLength: storedSecret.length,
    appConfigSecretLength: appSecret.length,
    secretMatchesAppConfig: storedSecret.length > 0 && storedSecret === appSecret,
  };
}

export function sortSignedUrlQuery(url: string) {
  let query = new URL(url).search.slice(1);
  const searchParams = new URLSearchParams(query);
  if (
    searchParams.has('URLPrefix') &&
    searchParams.has('Signature') &&
    searchParams.has('KeyName') &&
    searchParams.has('Expires')
  ) {
    console.log('Found signed URL - ensuring parameter order');
    query = `URLPrefix=${searchParams.get('URLPrefix')}&Expires=${searchParams.get(
      'Expires',
    )}&KeyName=${searchParams.get('KeyName')}&Signature=${searchParams.get('Signature')}`;
    searchParams.delete('URLPrefix');
    searchParams.delete('KeyName');
    searchParams.delete('Expires');
    searchParams.delete('Signature');
    // append any remaining params
    if (searchParams.size > 0) query += '&' + searchParams.toString();
  }
  return query;
}
