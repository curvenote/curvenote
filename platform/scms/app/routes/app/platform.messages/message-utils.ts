import type { Message } from '@curvenote/scms-db';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Safe string for display; ignores objects/arrays so we never render [object Object]. */
function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value).trim();
  }
  return '';
}

function joinDisplayParts(value: unknown[]): string | undefined {
  const parts = value.map((item) => asTrimmedString(item)).filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function pickDisplayString(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value)) {
    return joinDisplayParts(value) ?? fallback;
  }
  const s = asTrimmedString(value);
  return s.length > 0 ? s : fallback;
}

function pickOptionalDisplayString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return joinDisplayParts(value);
  }
  const s = asTrimmedString(value);
  return s.length > 0 ? s : undefined;
}

/**
 * Returns true when the string looks like HTML (document or fragment), e.g. outbound email bodies.
 * Plain text (no leading markup) returns false so callers can show monospace text instead of an iframe.
 */
export function isLikelyHtmlContent(body: string): boolean {
  if (typeof body !== 'string') return false;
  let t = body.trim();
  if (!t) return false;
  t = t.replace(/^(\s*<!--[\s\S]*?-->\s*)+/i, '').trim();
  if (/^<!DOCTYPE\s+html/i.test(t)) return true;
  if (/^<html[\s/>]/i.test(t)) return true;
  // HTML element opening tag (typical email fragment: <div>, <p>, <table>, …)
  if (/^<[a-z][a-z0-9]*(\s|\/|>)/i.test(t)) return true;
  return false;
}

/**
 * Extracted email data from a message for display purposes
 */
export interface MessageEmailData {
  subject: string;
  from: string;
  to: string | undefined;
  date: string | undefined;
  body: string | undefined;
}

/** When inbound email results indicate failed content validation (e.g. missing template markers). */
export interface InboundEmailValidationWarning {
  /** Human-readable explanation, usually from `results.validation.reason`. */
  reason: string;
}

/**
 * For inbound email messages, returns validation failure details when `results.isValid === false`
 * or `results.validation.isValid === false`.
 */
export function extractInboundEmailValidationWarning(
  message: Message,
): InboundEmailValidationWarning | null {
  if (!message || typeof message.type !== 'string' || message.type !== 'inbound_email') {
    return null;
  }

  const raw = message.results;
  if (raw === null || raw === undefined || !isPlainRecord(raw)) {
    return null;
  }

  const validationRaw = raw.validation;
  const validation = isPlainRecord(validationRaw) ? validationRaw : undefined;

  const topInvalid = raw.isValid === false;
  const nestedInvalid = validation !== undefined && validation.isValid === false;
  if (!topInvalid && !nestedInvalid) {
    return null;
  }

  const reasonFromValidation = validation ? asTrimmedString(validation.reason) : '';
  const reasonTop = asTrimmedString(raw.reason);
  const reason =
    reasonFromValidation ||
    reasonTop ||
    'This message did not pass validation checks. See structured results for details.';

  return { reason };
}

/**
 * Extracts email display data from a message based on its type and schema availability.
 * Handles both schema-based (new) and legacy (backward compatibility) message formats.
 *
 * @param message - The message to extract data from
 * @param options - Optional configuration for fallback values
 * @returns Extracted email data for display
 */
export function extractMessageEmailData(
  message: Message,
  options: {
    fallbackTo?: string;
    fallbackDate?: string;
    fallbackBody?: string;
  } = {},
): MessageEmailData {
  if (!message) {
    return {
      subject: 'No subject',
      from: 'Unknown',
      to: undefined,
      date: undefined,
      body: options.fallbackBody,
    };
  }

  const payloadUnknown = message.payload;
  const payload = isPlainRecord(payloadUnknown) ? payloadUnknown : undefined;
  const headers =
    payload && isPlainRecord(payload.headers)
      ? (payload.headers as Record<string, unknown>)
      : undefined;
  const envelope =
    payload && isPlainRecord(payload.envelope)
      ? (payload.envelope as Record<string, unknown>)
      : undefined;

  const resultsUnknown = message.results;
  const results = isPlainRecord(resultsUnknown) ? resultsUnknown : undefined;
  const hasPayloadSchema = Boolean(payload && '$schema' in payload && payload.$schema);
  const hasResultsSchema = Boolean(results && '$schema' in results && results.$schema);

  const { fallbackTo = undefined, fallbackDate = undefined, fallbackBody = undefined } = options;

  // Determine if we should use structured data from payload or results (if schema exists)
  let subject: string;
  let from: string;
  let to: string | undefined;
  let date: string | undefined;
  let body: string | undefined;

  if (message.type === 'outbound_email') {
    // Outbound email - payload contains email details, results only has success info
    if (hasPayloadSchema && payload) {
      subject = pickDisplayString(payload.subject, 'No subject');
      from = pickDisplayString(payload.from, 'Unknown');
      to = pickOptionalDisplayString(payload.to) ?? fallbackTo;
      date = pickOptionalDisplayString(payload.sentAt) ?? fallbackDate;
      body = pickOptionalDisplayString(payload.html) ?? fallbackBody;
    } else {
      subject = pickDisplayString(payload?.subject, 'No subject');
      from = pickDisplayString(payload?.from, 'Unknown');
      to = pickOptionalDisplayString(payload?.to) ?? fallbackTo;
      date = pickOptionalDisplayString(payload?.sentAt) ?? fallbackDate;
      body = pickOptionalDisplayString(payload?.html) ?? fallbackBody;
    }
  } else if (message.type === 'inbound_email') {
    // Inbound email - results has structured data, payload is unknown structure
    if (hasResultsSchema && results) {
      subject = pickDisplayString(results.subject, 'No subject');
      from = pickDisplayString(results.from, 'Unknown');
      to = pickOptionalDisplayString(results.to);
      date = pickOptionalDisplayString(results.receivedAt);
      body =
        pickOptionalDisplayString(results.plain) ??
        pickOptionalDisplayString(results.html) ??
        undefined;
    } else {
      subject = pickDisplayString(headers?.subject ?? payload?.subject, 'No subject');
      from = pickDisplayString(headers?.from ?? envelope?.from ?? payload?.from, 'Unknown');
      to =
        pickOptionalDisplayString(headers?.to) ??
        pickOptionalDisplayString(envelope?.to) ??
        pickOptionalDisplayString(payload?.to);
      date =
        pickOptionalDisplayString(headers?.date) ??
        pickOptionalDisplayString(envelope?.date) ??
        pickOptionalDisplayString(payload?.date);
      body = pickOptionalDisplayString(payload?.plain) ?? pickOptionalDisplayString(payload?.html);
    }
  } else {
    // Other message types - use payload
    subject = pickDisplayString(headers?.subject ?? payload?.subject, message.id ?? 'No subject');
    from = pickDisplayString(headers?.from ?? envelope?.from ?? payload?.from, 'Unknown');
    to =
      pickOptionalDisplayString(headers?.to) ??
      pickOptionalDisplayString(envelope?.to) ??
      pickOptionalDisplayString(payload?.to);
    date =
      pickOptionalDisplayString(headers?.date) ??
      pickOptionalDisplayString(envelope?.date) ??
      pickOptionalDisplayString(payload?.date);
    body =
      pickOptionalDisplayString(payload?.plain) ??
      pickOptionalDisplayString(payload?.html) ??
      fallbackBody;
  }

  return {
    subject,
    from,
    to,
    date,
    body,
  };
}
