import crypto from 'node:crypto';
import type { ActionFunctionArgs } from 'react-router';
import { getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 as uuid } from 'uuidv7';

const MAX_BODY_BYTES = 32 * 1024;
const ACCEPTED_CONTENT_TYPES = new Set([
  'application/csp-report',
  'application/reports+json',
  'application/json',
]);

type CspLegacyPayload = {
  'csp-report': Record<string, unknown>;
};

type CspReportToPayload = Array<{
  type?: unknown;
  body?: Record<string, unknown>;
}>;

function isAcceptedContentType(contentTypeHeader: string | null) {
  if (!contentTypeHeader) return false;
  const contentType = contentTypeHeader.split(';')[0]?.trim().toLowerCase();
  return ACCEPTED_CONTENT_TYPES.has(contentType);
}

function asString(value: unknown, maxLength = 512) {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, maxLength);
}

function asInt(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

function parseUrl(value: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function originFromUri(value: unknown) {
  const url = parseUrl(value);
  if (!url) return typeof value === 'string' ? value.slice(0, 256) : undefined;
  return url.origin.slice(0, 256);
}

function pathFromUri(value: unknown) {
  const url = parseUrl(value);
  if (!url) return undefined;
  return url.pathname.slice(0, 1024);
}

function normalizeReports(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return [];
  if (
    'csp-report' in payload &&
    payload['csp-report'] &&
    typeof payload['csp-report'] === 'object'
  ) {
    return [payload['csp-report'] as Record<string, unknown>];
  }
  if (Array.isArray(payload)) {
    return payload
      .filter((entry): entry is CspReportToPayload[number] => !!entry && typeof entry === 'object')
      .filter(
        (entry) => entry.type === 'csp-violation' && !!entry.body && typeof entry.body === 'object',
      )
      .map((entry) => entry.body!);
  }
  return [];
}

function readContentLength(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (!Number.isFinite(contentLength) || contentLength < 0) return undefined;
  return contentLength;
}

function buildFingerprint(parts: {
  effectiveDirective?: string;
  blockedOrigin?: string;
  documentPath?: string;
  disposition?: string;
}) {
  const input = [
    parts.effectiveDirective ?? '',
    parts.blockedOrigin ?? '',
    parts.documentPath ?? '',
    parts.disposition ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(input).digest('hex');
}

type ExtractedReport = {
  fingerprint: string;
  effectiveDirective?: string;
  violatedDirective?: string;
  blockedUri?: string;
  blockedOrigin?: string;
  documentOrigin?: string;
  documentPath?: string;
  disposition?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgentSample?: string;
  latestPayload: Record<string, unknown>;
};

function extractReport(report: Record<string, unknown>, request: Request): ExtractedReport {
  const blockedUri = asString(report['blocked-uri']) ?? asString(report.blockedURL);
  const documentUri = asString(report['document-uri']) ?? asString(report.documentURL);
  const effectiveDirective =
    asString(report['effective-directive']) ?? asString(report.effectiveDirective);
  const blockedOrigin = originFromUri(blockedUri);
  const documentOrigin = originFromUri(documentUri);
  const documentPath = pathFromUri(documentUri);
  const disposition = asString(report.disposition, 32);
  return {
    fingerprint: buildFingerprint({
      effectiveDirective,
      blockedOrigin,
      documentPath,
      disposition,
    }),
    effectiveDirective,
    violatedDirective: asString(report['violated-directive']) ?? asString(report.violatedDirective),
    blockedUri: blockedUri?.slice(0, 1024),
    blockedOrigin,
    documentOrigin,
    documentPath,
    disposition,
    sourceFile: asString(report['source-file']) ?? asString(report.sourceFile),
    lineNumber: asInt(report['line-number']) ?? asInt(report.lineNumber),
    columnNumber: asInt(report['column-number']) ?? asInt(report.columnNumber),
    userAgentSample: asString(request.headers.get('user-agent'), 512),
    latestPayload: report,
  };
}

async function persistReport(extracted: ExtractedReport) {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();
  await prisma.cspViolationReport.upsert({
    where: { fingerprint: extracted.fingerprint },
    create: {
      id: uuid(),
      fingerprint: extracted.fingerprint,
      effective_directive: extracted.effectiveDirective,
      violated_directive: extracted.violatedDirective,
      blocked_uri: extracted.blockedUri,
      blocked_origin: extracted.blockedOrigin,
      document_origin: extracted.documentOrigin,
      document_path: extracted.documentPath,
      disposition: extracted.disposition,
      source_file: extracted.sourceFile,
      line_number: extracted.lineNumber,
      column_number: extracted.columnNumber,
      user_agent_sample: extracted.userAgentSample,
      latest_payload: extracted.latestPayload as object,
      count: 1,
      date_first_seen: now,
      date_last_seen: now,
    },
    update: {
      count: { increment: 1 },
      date_last_seen: now,
      violated_directive: extracted.violatedDirective,
      blocked_uri: extracted.blockedUri,
      document_origin: extracted.documentOrigin,
      source_file: extracted.sourceFile,
      line_number: extracted.lineNumber,
      column_number: extracted.columnNumber,
      user_agent_sample: extracted.userAgentSample,
      latest_payload: extracted.latestPayload as object,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const contentLength = readContentLength(request);
  if (contentLength != null && contentLength > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 });
  }

  if (!isAcceptedContentType(request.headers.get('content-type'))) {
    return new Response(null, { status: 204 });
  }

  let textBody: string;
  try {
    textBody = await request.text();
  } catch {
    return new Response(null, { status: 204 });
  }

  if (!textBody || textBody.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 });
  }

  let parsed: CspLegacyPayload | CspReportToPayload | Record<string, unknown>;
  try {
    parsed = JSON.parse(textBody);
  } catch {
    return new Response(null, { status: 204 });
  }

  const reports = normalizeReports(parsed);
  if (reports.length === 0) return new Response(null, { status: 204 });

  for (const report of reports) {
    try {
      await persistReport(extractReport(report, request));
    } catch (err) {
      // Never let a misbehaving report take down the endpoint or surface DB errors to the reporter.
      console.warn('csp_violation_report_persist_failed', err);
    }
  }

  return new Response(null, { status: 204 });
}

export async function loader() {
  return new Response('Method Not Allowed', { status: 405 });
}
