/**
 * Crossref HTTP calls for site DOI configuration. HTTP only, no business logic.
 * Behaviour: Linear "Crossref integration facts". Never log or persist response
 * headers, and never put credentials in error messages.
 */
const PREFIXES_API = 'https://api.crossref.org/prefixes';
const TIMEOUT_MS = 10_000;
/** A file name that never exists, so submissionDownload only proves the login. */
const ROLE_CHECK_FILE_NAME = 'curvenote-role-check.xml';

export type CrossrefCredentials = { host: string; depositorEmail: string; password: string };
type FetchOpts = { fetch?: typeof fetch };

export class CrossrefError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CrossrefError';
  }
}

async function request(url: string, what: string, opts?: FetchOpts): Promise<Response> {
  const doFetch = opts?.fetch ?? fetch;
  try {
    return await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e: any) {
    throw new CrossrefError(`Crossref ${what} request failed: ${e?.name ?? 'network error'}`, true);
  }
}

function unexpected(what: string, status: number): CrossrefError {
  return new CrossrefError(
    `Crossref ${what} answered ${status}`,
    status === 429 || status >= 500,
    status,
  );
}

export async function lookupPrefix(prefix: string, opts?: FetchOpts) {
  const resp = await request(
    `${PREFIXES_API}/${encodeURIComponent(prefix)}`,
    'prefix lookup',
    opts,
  );
  if (resp.status === 404) return null;
  if (!resp.ok) throw unexpected('prefix lookup', resp.status);
  let body: { message?: { name?: string; member?: string } };
  try {
    body = await resp.json();
  } catch {
    throw new CrossrefError(
      'Crossref prefix lookup returned an unexpected body',
      false,
      resp.status,
    );
  }
  if (!body.message?.name || !body.message.member) {
    throw new CrossrefError(
      'Crossref prefix lookup returned an unexpected body',
      false,
      resp.status,
    );
  }
  return { prefix, ownerName: body.message.name, memberUrl: body.message.member };
}

export async function checkRole(creds: CrossrefCredentials, role: string, opts?: FetchOpts) {
  const params = new URLSearchParams({
    usr: `${creds.depositorEmail}/${role}`,
    pwd: creds.password,
    file_name: ROLE_CHECK_FILE_NAME,
    type: 'result',
  });
  const resp = await request(
    `${creds.host}/servlet/submissionDownload?${params}`,
    'role check',
    opts,
  );
  if (resp.status === 401) return { authenticated: false };
  if (!resp.ok) throw unexpected('role check', resp.status);
  const body = await resp.text();
  if (!body.includes('doi_batch_diagnostic')) {
    throw new CrossrefError('Crossref role check returned an unexpected body', false, resp.status);
  }
  return { authenticated: true };
}

export function crossrefCredentialsFromConfig(config: AppConfig): CrossrefCredentials {
  const c = config.api?.crossref;
  if (!c?.host || !c.depositorEmail || !c.password) {
    throw new Error('Crossref requires api.crossref.host, depositorEmail and password in config');
  }
  return {
    host: c.host.replace(/\/$/, ''),
    depositorEmail: c.depositorEmail,
    password: c.password,
  };
}
