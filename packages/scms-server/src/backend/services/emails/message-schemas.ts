/**
 * JSON schemas for message data stored in the messages table
 * These schemas help UI components understand the structure of message data
 */

/**
 * Schema for outbound email payload - contains all email details being sent
 */
export const OUTBOUND_EMAIL_PAYLOAD_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description:
    'Schema for outbound email payload containing all email details being sent, including recipient, sender, subject, HTML content, and metadata.',
  type: 'object',
  properties: {
    eventType: { type: 'string', description: 'The type of email event being sent' },
    to: { type: 'string', format: 'email', description: 'Recipient email address' },
    from: { type: 'string', description: 'Sender email address' },
    subject: { type: 'string', description: 'Email subject line' },
    html: { type: 'string', description: 'HTML content of the email' },
    ignoreUnsubscribe: {
      type: 'boolean',
      description: 'Whether to ignore unsubscribe preferences for this email',
    },
    resendId: {
      type: ['string', 'null'],
      description: 'Resend API message ID if available, null otherwise',
    },
    sentAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO timestamp when email was sent',
    },
  },
  required: ['eventType', 'to', 'from', 'subject', 'sentAt'],
};

/**
 * Schema for outbound email results - only contains success confirmation
 */
export const OUTBOUND_EMAIL_RESULTS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description:
    'Schema for outbound email results containing only success confirmation information. This minimal structure indicates the email was successfully sent.',
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['SUCCESS'],
      description: 'Status indicating the email was successfully sent',
    },
    resendId: {
      type: ['string', 'null'],
      description: 'Resend API message ID returned after successful send, null if not available',
    },
    sentAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO timestamp when the email was successfully sent',
    },
  },
  required: ['status', 'sentAt'],
};

/**
 * Schema for inbound email payload - unknown structure (any)
 * This indicates the payload can be any object structure
 */
export const INBOUND_EMAIL_PAYLOAD_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description:
    'Schema for inbound email payload indicating an unknown structure. The payload contains raw data from the email provider (e.g., CloudMailin) with an unpredictable structure that may vary by provider.',
  type: 'object',
  additionalProperties: true,
};

/**
 * Schema for inbound email results - well-known structured data
 */
export const INBOUND_EMAIL_RESULTS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description:
    'Schema for inbound email results containing well-known structured data extracted from the raw email payload. This normalized structure is used by UI components to display email information consistently.',
  type: 'object',
  properties: {
    from: { type: 'string', description: 'Sender email address' },
    to: { type: 'string', format: 'email', description: 'Recipient email address' },
    subject: { type: 'string', description: 'Email subject line' },
    receivedAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO timestamp when the email was received',
    },
    headers: {
      type: 'object',
      description: 'Email headers extracted from the raw payload',
      properties: {
        from: { type: 'string', description: 'From header value' },
        to: { type: 'string', description: 'To header value' },
        subject: { type: 'string', description: 'Subject header value' },
        date: { type: 'string', description: 'Date header value' },
      },
    },
    envelope: {
      type: 'object',
      description: 'SMTP envelope information from the email provider',
      properties: {
        from: { type: 'string', description: 'Envelope from address' },
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of envelope to addresses',
        },
      },
    },
    plain: { type: 'string', description: 'Plain text content of the email' },
    html: { type: 'string', description: 'HTML content of the email' },
  },
  required: ['from', 'subject', 'receivedAt'],
};

// Legacy exports for backward compatibility
export const OUTBOUND_EMAIL_SCHEMA = OUTBOUND_EMAIL_PAYLOAD_SCHEMA;
export const INBOUND_EMAIL_SCHEMA = INBOUND_EMAIL_RESULTS_SCHEMA;
