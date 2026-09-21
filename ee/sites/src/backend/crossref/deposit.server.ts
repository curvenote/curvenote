/**
 * Crossref deposit servlet. HTTP only, no business logic.
 * Behaviour: Linear "Crossref integration facts". 200 only means "received": validity arrives
 * later in the submissionDownload result. Never log response headers: a 200 carries tokens.
 */
import {
  CrossrefError,
  crossrefFetch,
  crossrefText,
  type CrossrefCredentials,
  type FetchOpts,
} from './client.server.js';

/** Up to 10 MB per upload, so allow longer than the lookup calls. */
const TIMEOUT_MS = 60_000;
const LABEL = 'Crossref deposit';

export type DepositInput = {
  /** CUSTOM_PREFIX sites deposit under their own role, CURVENOTE_PREFIX sites under Curvenote's. */
  role: string;
  /** The multipart filename. Crossref keeps it verbatim as the tracking `file_name`. */
  fileName: string;
  xml: string;
};

export type DepositResponse = { state: 'received' } | { state: 'unauthorized' };

export async function deposit(
  creds: CrossrefCredentials,
  input: DepositInput,
  opts?: FetchOpts,
): Promise<DepositResponse> {
  const form = new FormData();
  form.append('operation', 'doMDUpload');
  form.append('login_id', `${creds.depositorEmail}/${input.role}`);
  form.append('login_passwd', creds.password);
  form.append('fname', new Blob([input.xml], { type: 'application/xml' }), input.fileName);
  const resp = await crossrefFetch(
    {
      label: LABEL,
      url: `${creds.host}/servlet/deposit`,
      init: { method: 'POST', body: form },
      timeoutMs: TIMEOUT_MS,
      expect: [401],
    },
    opts,
  );
  if (resp.status === 401) {
    return { state: 'unauthorized' };
  }
  // An empty or malformed POST also gets a 200, with a blank body.
  if (!/\bSUCCESS\b/.test(await crossrefText(resp, LABEL))) {
    throw new CrossrefError(`${LABEL} was not received`, resp.status);
  }
  return { state: 'received' };
}
