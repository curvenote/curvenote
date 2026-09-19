/**
 * Crossref HTTP calls for site DOI configuration. HTTP only, no business logic.
 * Behaviour: Linear "Crossref integration facts". Never log or persist response
 * headers, and never put credentials in error messages.
 */
import { z } from 'zod';
import { PREFIX_RE } from './prefix.js';

const PREFIXES_API = 'https://api.crossref.org/prefixes';
const TIMEOUT_MS = 10_000;
/** A file name that never exists, so submissionDownload only proves the login. */
const ROLE_CHECK_FILE_NAME = 'curvenote-role-check.xml';

const CredentialsSchema = z.object({
  host: z.httpUrl().transform((host) => host.replace(/\/$/, '')),
  depositorEmail: z.email(),
  password: z.string().min(1),
  /** Curvenote's own prefix: used by CURVENOTE_PREFIX sites and refused on CUSTOM_PREFIX ones. */
  prefix: z.string().regex(PREFIX_RE),
  /** Curvenote's own role: used by CURVENOTE_PREFIX sites and as the control login on a 401. */
  role: z.string().min(1),
});

const PrefixResponseSchema = z.object({
  message: z.object({ name: z.string().min(1), member: z.string().min(1) }),
});

export type CrossrefCredentials = z.output<typeof CredentialsSchema>;
type FetchOpts = { fetch?: typeof fetch };
type LookupOpts = FetchOpts & { contactEmail?: string };

/** `status` is undefined when no response arrived (timeout or network failure). */
export class CrossrefError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CrossrefError';
  }
}

export async function lookupPrefix(prefix: string, opts?: LookupOpts) {
  const doFetch = opts?.fetch ?? fetch;
  let resp: Response;
  try {
    resp = await doFetch(`${PREFIXES_API}/${encodeURIComponent(prefix)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // api.crossref.org asks polite clients to identify themselves with a contact address.
      ...(opts?.contactEmail
        ? { headers: { 'User-Agent': `Curvenote-SCMS (mailto:${opts.contactEmail})` } }
        : {}),
    });
  } catch (e: any) {
    throw new CrossrefError(`Crossref prefix lookup request failed: ${e?.name ?? 'network error'}`);
  }
  if (resp.status === 404) {
    return null;
  }
  if (!resp.ok) {
    throw new CrossrefError(`Crossref prefix lookup answered ${resp.status}`, resp.status);
  }
  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    throw new CrossrefError('Crossref prefix lookup returned an unexpected body', resp.status);
  }
  const parsed = PrefixResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new CrossrefError('Crossref prefix lookup returned an unexpected body', resp.status);
  }
  const { name, member } = parsed.data.message;
  return { prefix, ownerName: name, memberUrl: member };
}

export async function checkRole(creds: CrossrefCredentials, role: string, opts?: FetchOpts) {
  const params = new URLSearchParams({
    usr: `${creds.depositorEmail}/${role}`,
    pwd: creds.password,
    file_name: ROLE_CHECK_FILE_NAME,
    type: 'result',
  });
  const doFetch = opts?.fetch ?? fetch;
  let resp: Response;
  try {
    resp = await doFetch(`${creds.host}/servlet/submissionDownload?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e: any) {
    // Only the error name: the URL holds the password, so the original message is never forwarded.
    throw new CrossrefError(`Crossref role check request failed: ${e?.name ?? 'network error'}`);
  }
  if (resp.status === 401) {
    return { authenticated: false };
  }
  if (!resp.ok) {
    throw new CrossrefError(`Crossref role check answered ${resp.status}`, resp.status);
  }
  let body: string;
  try {
    body = await resp.text();
  } catch {
    throw new CrossrefError('Crossref role check returned an unreadable body', resp.status);
  }
  if (!body.includes('doi_batch_diagnostic')) {
    throw new CrossrefError('Crossref role check returned an unexpected body', resp.status);
  }
  return { authenticated: true };
}

/** Errors name the invalid fields only; zod issues never carry the input, so no password leaks. */
export function crossrefCredentialsFromConfig(config: AppConfig): CrossrefCredentials {
  const parsed = CredentialsSchema.safeParse(config.api?.crossref);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ['api.crossref', ...i.path].join('.'));
    throw new Error(`Crossref config is missing or invalid: ${fields.join(', ')}`);
  }
  return parsed.data;
}
