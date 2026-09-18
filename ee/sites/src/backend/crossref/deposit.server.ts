/**
 * Crossref deposit servlet. HTTP only, no business logic.
 * Behaviour: Linear "Crossref integration facts". 200 only means "received": validity arrives
 * later in the submissionDownload result. Never log response headers: a 200 carries tokens.
 */
import { CrossrefError, type CrossrefCredentials } from './client.server.js';

/** Up to 10 MB per upload, so allow longer than the lookup calls. */
const TIMEOUT_MS = 60_000;

export type DepositInput = {
  /** CUSTOM_PREFIX sites deposit under their own role, CURVENOTE_PREFIX sites under Curvenote's. */
  role: string;
  /** The multipart filename. Crossref keeps it verbatim as the tracking `file_name`. */
  fileName: string;
  xml: string;
};

export type DepositOutcome = { received: true } | { received: false; reason: 'unauthorized' };

type FetchOpts = { fetch?: typeof fetch };

export async function deposit(
  creds: CrossrefCredentials,
  input: DepositInput,
  opts?: FetchOpts,
): Promise<DepositOutcome> {
  const form = new FormData();
  form.append('operation', 'doMDUpload');
  form.append('login_id', `${creds.depositorEmail}/${input.role}`);
  form.append('login_passwd', creds.password);
  form.append('fname', new Blob([input.xml], { type: 'application/xml' }), input.fileName);
  const doFetch = opts?.fetch ?? fetch;
  let resp: Response;
  try {
    resp = await doFetch(`${creds.host}/servlet/deposit`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e: any) {
    // Only the error name: the request carries the password.
    throw new CrossrefError(`Crossref deposit request failed: ${e?.name ?? 'network error'}`);
  }
  if (resp.status === 401) {
    return { received: false, reason: 'unauthorized' };
  }
  if (!resp.ok) {
    throw new CrossrefError(`Crossref deposit answered ${resp.status}`, resp.status);
  }
  let body: string;
  try {
    body = await resp.text();
  } catch {
    throw new CrossrefError('Crossref deposit returned an unreadable body', resp.status);
  }
  // An empty or malformed POST also gets a 200, with a blank body.
  if (!body.includes('SUCCESS')) {
    throw new CrossrefError('Crossref deposit was not received', resp.status);
  }
  return { received: true };
}
