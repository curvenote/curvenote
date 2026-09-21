/**
 * Crossref submissionDownload, `type=result`. Owns every call to that servlet: the outcome of one
 * deposit, tracked by `file_name` (Crossref only knows `doi_batch_id` once the file is parsed, so a
 * failed deposit never resolves by it), and the login probe behind `checkRole`.
 * HTTP and parsing only; mapping to DoiDeposit statuses is the caller's.
 *
 * The credentials travel in the POST body, not the query string, so they never reach URL logs.
 * Crossref documents this servlet as GET with query parameters; observed on 2026-09-21 that it
 * reads the same parameters from a form body (bad credentials answer 401 "Wrong credentials",
 * an empty POST answers 401 "No login info in request"). Checked against test.crossref.org the
 * same day for `file_name`s that really were deposited, one succeeded and one failed to validate:
 * both answered byte-identically to the query-string form, so the file lookup behaves the same
 * once authentication passes.
 */
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import {
  CrossrefError,
  crossrefFetch,
  crossrefText,
  type CrossrefCredentials,
  type FetchOpts,
} from './client.server.js';

const TIMEOUT_MS = 10_000;
const LABEL = 'Crossref result';
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
      /**
       * `warning` still means every record went in, but Crossref flagged at least one of them;
       * the message is on the record. Product asked for this to be visible, not folded into success.
       */
      outcome: 'success' | 'warning' | 'failure';
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

function batchOutcome(records: DepositRecord[]): 'success' | 'warning' | 'failure' {
  if (records.some((r) => r.status === 'failure')) {
    return 'failure';
  }
  return records.some((r) => r.status === 'warning') ? 'warning' : 'success';
}

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
        outcome: batchOutcome(records),
        records,
      };
    }
  }
}

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
  const resp = await crossrefFetch(
    {
      label: LABEL,
      url: `${creds.host}/servlet/submissionDownload`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      },
      timeoutMs: TIMEOUT_MS,
      expect: [401],
    },
    opts,
  );
  if (resp.status === 401) {
    return { state: 'unauthorized' };
  }
  const xml = await crossrefText(resp, LABEL);
  return { ...parseDepositResult(xml), xml };
}

/** A file name that never exists, so submissionDownload only proves the login. */
const ROLE_CHECK_FILE_NAME = 'curvenote-role-check.xml';

/**
 * Does `<depositorEmail>/<role>` authenticate? A role check is a result fetch for a file name that
 * was never deposited: Crossref answers `unknown_submission` when the login is good and 401 when it
 * is not, so anything that parses as a diagnostic proves the credentials.
 */
export async function checkRole(creds: CrossrefCredentials, role: string, opts?: FetchOpts) {
  const result = await fetchDepositResult(creds, { role, fileName: ROLE_CHECK_FILE_NAME }, opts);
  return { authenticated: result.state !== 'unauthorized' };
}
