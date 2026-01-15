import type { Message } from '@curvenote/scms-db/browser';

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
  const payload = message.payload as any;
  const results = message.results as any;
  const hasPayloadSchema = payload?.$schema;
  const hasResultsSchema = results?.$schema;

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
      // Use payload for email details (new schema-based structure)
      subject = payload.subject || 'No subject';
      from = payload.from || 'Unknown';
      to = payload.to;
      date = payload.sentAt;
      body = payload.html;
    } else {
      // Fallback to payload (backward compatibility for records without schema)
      subject = payload?.subject || 'No subject';
      from = payload?.from || 'Unknown';
      to = payload?.to || fallbackTo;
      date = payload?.sentAt || fallbackDate;
      body = payload?.html || fallbackBody;
    }
  } else if (message.type === 'inbound_email') {
    // Inbound email - results has structured data, payload is unknown structure
    if (hasResultsSchema && results) {
      // Use results for structured data (new schema-based structure)
      subject = results.subject || 'No subject';
      from = results.from || 'Unknown';
      to = results.to;
      date = results.receivedAt;
      body = results.plain || results.html;
    } else {
      // Fallback to payload (backward compatibility for existing records)
      subject = payload?.headers?.subject || payload?.subject || 'No subject';
      from = payload?.headers?.from || payload?.envelope?.from || payload?.from || 'Unknown';
      to = payload?.headers?.to || payload?.envelope?.to || payload?.to;
      date = payload?.headers?.date || payload?.envelope?.date || payload?.date;
      body = payload?.plain || payload?.html;
    }
  } else {
    // Other message types - use payload
    subject = payload?.headers?.subject || payload?.subject || message.id;
    from = payload?.headers?.from || payload?.envelope?.from || payload?.from || 'Unknown';
    to = payload?.headers?.to || payload?.envelope?.to || payload?.to;
    date = payload?.headers?.date || payload?.envelope?.date || payload?.date;
    // Ensure body is always a string or undefined, never an object
    const plainOrHtml = payload?.plain || payload?.html;
    if (plainOrHtml && typeof plainOrHtml === 'string') {
      body = plainOrHtml;
    } else {
      body = fallbackBody;
    }
  }

  return {
    subject,
    from,
    to,
    date,
    body,
  };
}
