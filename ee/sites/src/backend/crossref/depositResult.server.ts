/**
 * Crossref submissionDownload, `type=result`: the outcome of one deposit, tracked by `file_name`
 * (Crossref only knows `doi_batch_id` once the file is parsed, so a failed deposit never
 * resolves by it). HTTP and parsing only; mapping to DoiDeposit statuses is the caller's.
 */
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { CrossrefError, type CrossrefCredentials } from './client.server.js';

const TIMEOUT_MS = 10_000;
const RECORD_STATUS = { Success: 'success', Warning: 'warning', Failure: 'failure' } as const;

export type DepositRecord = {
  status: (typeof RECORD_STATUS)[keyof typeof RECORD_STATUS];
  /** Empty in Crossref's answer when the record failed. */
  doi: string | null;
  message: string;
};

export type ParsedDepositResult =
  | { state: 'unknown_submission' }
  | { state: 'queued'; submissionId: string }
  | {
      state: 'completed';
      submissionId: string;
      batchId: string;
      /** A warning still means the record went in. */
      outcome: 'success' | 'failure';
      records: DepositRecord[];
    };

/** `xml` is the raw body, kept for DoiDeposit.result_xml_path. */
export type DepositResult = (ParsedDepositResult & { xml: string }) | { state: 'unauthorized' };

export type DepositResultInput = { role: string; fileName: string };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Ids stay strings, and a batch with one record still yields an array.
  parseTagValue: false,
  isArray: (name) => name === 'record_diagnostic',
});

const unexpected = () => new CrossrefError('Crossref result has an unexpected body', 200);

/** `<doi />` and `<msg />` parse to `''`; an id that is absent or empty is a malformed answer. */
const id = z.string().min(1);

const RecordDiagnosticSchema = z.object({
  '@_status': z.enum(['Success', 'Warning', 'Failure']),
  doi: z.string().default(''),
  msg: z.string().default(''),
});

/**
 * `doi_batch_diagnostic` keyed on its `status` attribute. Unknown keys (`batch_data`, `@_sp`,
 * the empty `batch_id` on a queued answer) are dropped; anything else is `unexpected()`.
 */
const DiagnosticSchema = z.discriminatedUnion('@_status', [
  z.object({ '@_status': z.literal('unknown_submission') }),
  z.object({ '@_status': z.literal('queued'), submission_id: id }),
  z.object({
    '@_status': z.literal('completed'),
    submission_id: id,
    batch_id: id,
    record_diagnostic: z.array(RecordDiagnosticSchema).min(1),
  }),
]);

export function parseDepositResult(xml: string): ParsedDepositResult {
  let root: unknown;
  try {
    root = parser.parse(xml)?.doi_batch_diagnostic;
  } catch {
    throw unexpected();
  }
  const parsed = DiagnosticSchema.safeParse(root);
  if (!parsed.success) {
    throw unexpected();
  }
  const diagnostic = parsed.data;
  switch (diagnostic['@_status']) {
    case 'unknown_submission':
      return { state: 'unknown_submission' };
    case 'queued':
      return { state: 'queued', submissionId: diagnostic.submission_id };
    case 'completed': {
      const records: DepositRecord[] = diagnostic.record_diagnostic.map((raw) => ({
        status: RECORD_STATUS[raw['@_status']],
        doi: raw.doi || null,
        message: raw.msg,
      }));
      return {
        state: 'completed',
        submissionId: diagnostic.submission_id,
        batchId: diagnostic.batch_id,
        outcome: records.some((r) => r.status === 'failure') ? 'failure' : 'success',
        records,
      };
    }
  }
}

type FetchOpts = { fetch?: typeof fetch };

export async function fetchDepositResult(
  creds: CrossrefCredentials,
  input: DepositResultInput,
  opts?: FetchOpts,
): Promise<DepositResult> {
  const params = new URLSearchParams({
    usr: `${creds.depositorEmail}/${input.role}`,
    pwd: creds.password,
    file_name: input.fileName,
    type: 'result',
  });
  const doFetch = opts?.fetch ?? fetch;
  let resp: Response;
  try {
    resp = await doFetch(`${creds.host}/servlet/submissionDownload?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e: any) {
    // Only the error name: the URL holds the password.
    throw new CrossrefError(`Crossref result request failed: ${e?.name ?? 'network error'}`);
  }
  if (resp.status === 401) {
    return { state: 'unauthorized' };
  }
  if (!resp.ok) {
    throw new CrossrefError(`Crossref result answered ${resp.status}`, resp.status);
  }
  let xml: string;
  try {
    xml = await resp.text();
  } catch {
    throw new CrossrefError('Crossref result returned an unreadable body', resp.status);
  }
  return { ...parseDepositResult(xml), xml };
}
