import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

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

function toPathOnlyUrl(value: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 1024);
  } catch {
    return value.slice(0, 1024);
  }
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

function logCspReport(report: Record<string, unknown>, request: Request) {
  const payload = {
    event: 'csp_violation_report',
    ts: new Date().toISOString(),
    effectiveDirective:
      asString(report['effective-directive']) ?? asString(report.effectiveDirective),
    violatedDirective: asString(report['violated-directive']) ?? asString(report.violatedDirective),
    blockedUri: asString(report['blocked-uri']) ?? asString(report.blockedUri),
    documentUri: toPathOnlyUrl(report['document-uri']) ?? toPathOnlyUrl(report.documentUri),
    disposition: asString(report.disposition, 32),
    sourceFile: asString(report['source-file']) ?? asString(report.sourceFile),
    lineNumber:
      typeof report['line-number'] === 'number' ? report['line-number'] : report.lineNumber,
    columnNumber:
      typeof report['column-number'] === 'number' ? report['column-number'] : report.columnNumber,
    host: new URL(request.url).host,
    userAgent: asString(request.headers.get('user-agent'), 512),
  };
  console.info(JSON.stringify(payload));
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
    logCspReport(report, request);
  }

  return new Response(null, { status: 204 });
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  return new Response(null, { status: 204 });
}
