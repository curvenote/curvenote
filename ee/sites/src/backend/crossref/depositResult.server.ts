/**
 * Crossref submissionDownload, `type=result`: the outcome of one deposit, tracked by `file_name`
 * (Crossref only knows `doi_batch_id` once the file is parsed, so a failed deposit never
 * resolves by it). HTTP and parsing only; mapping to DoiDeposit statuses is the caller's.
 */
import { XMLParser } from 'fast-xml-parser';
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

type RawRecordDiagnostic = {
  '@_status'?: string;
  doi?: unknown;
  msg?: unknown;
};

const unexpected = () => new CrossrefError('Crossref result has an unexpected body', 200);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function toRecord(raw: RawRecordDiagnostic): DepositRecord {
  const status = RECORD_STATUS[raw?.['@_status'] as keyof typeof RECORD_STATUS];
  if (!status) {
    throw unexpected();
  }
  return { status, doi: text(raw.doi) || null, message: text(raw.msg) };
}

export function parseDepositResult(xml: string): ParsedDepositResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any;
  try {
    root = parser.parse(xml)?.doi_batch_diagnostic;
  } catch {
    throw unexpected();
  }
  switch (root?.['@_status']) {
    case 'unknown_submission':
      return { state: 'unknown_submission' };
    case 'queued':
      return { state: 'queued', submissionId: text(root.submission_id) };
    case 'completed': {
      const rawRecords: RawRecordDiagnostic[] = root.record_diagnostic ?? [];
      const records: DepositRecord[] = rawRecords.map(toRecord);
      if (records.length === 0) {
        throw unexpected();
      }
      return {
        state: 'completed',
        submissionId: text(root.submission_id),
        batchId: text(root.batch_id),
        outcome: records.some((r) => r.status === 'failure') ? 'failure' : 'success',
        records,
      };
    }
    default:
      throw unexpected();
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
