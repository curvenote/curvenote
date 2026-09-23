/**
 * Crossref HTTP plumbing shared by every call, plus the prefix lookup. HTTP only, no business
 * logic. Behaviour: Linear "Crossref integration facts". Never log or persist response headers,
 * and never put credentials in error messages.
 */
import { z } from 'zod';
import { PREFIX_RE } from './prefix.js';

const PREFIXES_API = 'https://api.crossref.org/prefixes';
const TIMEOUT_MS = 10_000;

const CredentialsSchema = z.object({
  host: z.httpUrl().transform((host) => host.replace(/\/$/, '')),
  depositorEmail: z.email(),
  password: z.string().min(1),
  /** Curvenote's own prefix: used by CURVENOTE_PREFIX sites and refused on CUSTOM_PREFIX ones. */
  prefix: z.string().regex(PREFIX_RE),
  /** Curvenote's own role: used by CURVENOTE_PREFIX sites and as the control login on a 401. */
  role: z.string().min(1),
  /** Landing page base the deposited DOIs resolve to: `<resourceUrlBase>/<doi>`. */
  resourceUrlBase: z.httpUrl().transform((url) => url.replace(/\/$/, '')),
});

const PrefixResponseSchema = z.object({
  message: z.object({ name: z.string().min(1), member: z.string().min(1) }),
});

export type CrossrefCredentials = z.output<typeof CredentialsSchema>;
export type FetchOpts = { fetch?: typeof fetch };
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

type CrossrefRequest = {
  /** Names the call in error messages, e.g. "Crossref deposit". */
  label: string;
  url: string;
  init?: RequestInit;
  timeoutMs: number;
  /** Non-2xx statuses the caller answers itself; any other one throws. */
  expect?: number[];
};

/**
 * Every Crossref request goes out through here. A request that never got an answer is reported
 * by the error's name only: the request carries the password, and the original error can repeat
 * the URL or the body.
 */
export async function crossrefFetch(req: CrossrefRequest, opts?: FetchOpts): Promise<Response> {
  const doFetch = opts?.fetch ?? fetch;
  let resp: Response;
  try {
    resp = await doFetch(req.url, { ...req.init, signal: AbortSignal.timeout(req.timeoutMs) });
  } catch (e) {
    const name = e instanceof Error ? e.name : 'network error';
    throw new CrossrefError(`${req.label} request failed: ${name}`);
  }
  if (!resp.ok && !req.expect?.includes(resp.status)) {
    throw new CrossrefError(`${req.label} answered ${resp.status}`, resp.status);
  }
  return resp;
}

export async function crossrefText(resp: Response, label: string): Promise<string> {
  try {
    return await resp.text();
  } catch {
    throw new CrossrefError(`${label} returned an unreadable body`, resp.status);
  }
}

export async function lookupPrefix(prefix: string, opts?: LookupOpts) {
  const resp = await crossrefFetch(
    {
      label: 'Crossref prefix lookup',
      url: `${PREFIXES_API}/${encodeURIComponent(prefix)}`,
      // api.crossref.org asks polite clients to identify themselves with a contact address.
      init: opts?.contactEmail
        ? { headers: { 'User-Agent': `Curvenote-SCMS (mailto:${opts.contactEmail})` } }
        : undefined,
      timeoutMs: TIMEOUT_MS,
      expect: [404],
    },
    opts,
  );
  if (resp.status === 404) {
    return null;
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

/** Errors name the invalid fields only; zod issues never carry the input, so no password leaks. */
export function crossrefCredentialsFromConfig(config: AppConfig): CrossrefCredentials {
  const parsed = CredentialsSchema.safeParse(config.api?.crossref);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ['api.crossref', ...i.path].join('.'));
    throw new Error(`Crossref config is missing or invalid: ${fields.join(', ')}`);
  }
  return parsed.data;
}
