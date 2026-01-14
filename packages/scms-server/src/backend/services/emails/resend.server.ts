import { Resend } from 'resend';
import type { Resend as ResendConfig } from '@/types/app-config.js';
import { render } from '@react-email/components';
import type {
  DefaultEmailProps,
  ResendEventType,
  ExtensionEmailTemplate,
} from '@curvenote/scms-core';
import { baseEmailTemplates, registerExtensionEmailTemplates } from '@curvenote/scms-core';
import { getPrismaClient } from '../../prisma.server.js';
import { uuidv7 } from 'uuidv7';
import { OUTBOUND_EMAIL_PAYLOAD_SCHEMA, OUTBOUND_EMAIL_RESULTS_SCHEMA } from './message-schemas.js';

export async function renderEmailTemplate(
  eventType: ResendEventType,
  props: any,
  defaultProps?: DefaultEmailProps,
  extensionTemplates?: ExtensionEmailTemplate[],
): Promise<string> {
  const emailTemplates = registerExtensionEmailTemplates(
    extensionTemplates || [],
    baseEmailTemplates,
  );
  const Template = emailTemplates[eventType];
  if (!Template) {
    throw new Error(`No template found for event type: ${eventType}`);
  }

  return render(Template({ ...defaultProps, ...props }));
}

export interface ResendEmail {
  eventType: string;
  to: string;
  subject: string;
  html: string;
  ignoreUnsubscribe?: boolean;
}

export interface ResendContext {
  resend?: Resend;
  resendConfig?: ResendConfig;
}

export interface TemplatedResendEmail<E extends ResendEventType, P extends object> {
  eventType: E;
  to: string;
  subject: string;
  templateProps: P;
  ignoreUnsubscribe?: boolean;
}

export function getResend(resendConfig?: ResendConfig) {
  if (!resendConfig?.apiKey || resendConfig?.disabled) return undefined;
  return new Resend(resendConfig.apiKey);
}

/**
 * Logs an outbound email to the messages table
 */
async function logEmailToMessages(
  email: ResendEmail,
  from: string,
  resendId: string | undefined,
  module?: string,
) {
  try {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();

    const payload = {
      $schema: OUTBOUND_EMAIL_PAYLOAD_SCHEMA,
      eventType: email.eventType,
      to: email.to,
      from,
      subject: email.subject,
      html: email.html,
      ignoreUnsubscribe: email.ignoreUnsubscribe,
      resendId: resendId || null,
      sentAt: now,
    };

    const results = {
      $schema: OUTBOUND_EMAIL_RESULTS_SCHEMA,
      status: 'SUCCESS',
      resendId: resendId || null,
      sentAt: now,
    };

    await prisma.message.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        module: module || 'SCMS',
        type: 'outbound_email',
        status: 'SUCCESS',
        payload,
        results,
      },
    });
  } catch (error) {
    // Don't fail email send if logging fails
    console.error('Failed to log email to messages table:', error);
  }
}

/**
 * Logs multiple outbound emails to the messages table in a single transaction using createMany
 */
async function batchLogEmailToMessages(
  emails: Array<{
    email: ResendEmail;
    from: string;
    resendId: string | undefined;
    module?: string;
  }>,
) {
  try {
    const prisma = await getPrismaClient();
    const now = new Date().toISOString();

    const messageData = emails.map(({ email, from, resendId, module }) => {
      const payload = {
        $schema: OUTBOUND_EMAIL_PAYLOAD_SCHEMA,
        eventType: email.eventType,
        to: email.to,
        from,
        subject: email.subject,
        html: email.html,
        ignoreUnsubscribe: email.ignoreUnsubscribe,
        resendId: resendId || null,
        sentAt: now,
      };

      const results = {
        $schema: OUTBOUND_EMAIL_RESULTS_SCHEMA,
        status: 'SUCCESS',
        resendId: resendId || null,
        sentAt: now,
      };

      return {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        module: module || 'SCMS',
        type: 'outbound_email',
        status: 'SUCCESS',
        payload,
        results,
      };
    });

    await prisma.message.createMany({
      data: messageData,
    });
  } catch (error) {
    // Don't fail email send if logging fails
    console.error('Failed to batch log emails to messages table:', error);
  }
}

export async function $sendRawEmail(
  email: ResendEmail,
  defaultProps: DefaultEmailProps,
  context: ResendContext,
  module?: string,
) {
  const { resend, resendConfig } = context;
  console.log('Resend email:', {
    eventType: email.eventType,
    to: email.to,
    subject: email.subject,
    html: email.html,
  });

  if (!resend) {
    console.log('Resend API key not configured');
    return;
  }

  if (resendConfig?.disabled) {
    console.log('Resend email sending disabled');
    return;
  }

  const from = resendConfig?.fromEmail;
  if (!from) {
    console.error('No from email address configured');
    return;
  }

  const headers: Record<string, string> = {};

  if (!email.ignoreUnsubscribe && defaultProps?.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${defaultProps.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('Skipping Resend email in development environment');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      headers,
    });

    if (error) {
      console.error('Failed to send Resend email:', error);
    } else {
      console.log('Resend email sent successfully:', data?.id);
      // Log successful email send to messages table
      await logEmailToMessages(email, from, data?.id, module);
    }
  } catch (error) {
    console.error('Error sending Resend email:', error);
  }
}

/**
 * Sends a templated email via Resend
 */
export async function $sendEmail<T extends ResendEventType, P extends object>(
  email: TemplatedResendEmail<T, P>,
  defaultProps: DefaultEmailProps,
  context: ResendContext,
  extensionTemplates?: ExtensionEmailTemplate[],
  module?: string,
) {
  const html = await renderEmailTemplate(
    email.eventType,
    email.templateProps,
    defaultProps,
    extensionTemplates,
  );

  await $sendRawEmail(
    {
      eventType: email.eventType,
      to: email.to,
      subject: email.subject,
      html,
      ignoreUnsubscribe: email.ignoreUnsubscribe,
    },
    defaultProps,
    context,
    module,
  );
}

/**
 * Sends a batch of raw emails via Resend
 */
export async function $sendRawEmailBatch(
  batch: { email: ResendEmail; defaultProps: DefaultEmailProps }[],
  context: ResendContext,
  module?: string,
) {
  console.log('Resend email batch:', {
    emailCount: batch.length,
    eventTypes: [...new Set(batch.map(({ email }) => email.eventType))],
    to: batch.map(({ email }) => email.to),
    subjects: [...new Set(batch.map(({ email }) => email.subject))],
  });

  const { resend, resendConfig } = context;

  if (!resend) {
    console.log('Resend API key not configured');
    return;
  }
  if (resendConfig?.disabled) {
    console.log('Resend email sending disabled');
    return;
  }
  const from = resendConfig?.fromEmail;
  if (!from) {
    console.error('No from email address configured');
    return;
  }
  if (process.env.NODE_ENV === 'development') {
    console.log('Skipping Resend email in development environment');
    return;
  }
  if (batch.length > 100) {
    console.error('Batch size is greater than 100; only sending first 100 emails');
    batch = batch.slice(0, 100);
  }

  const emailBatch = batch.map(({ email, defaultProps }) => {
    const headers: Record<string, string> = {};
    if (!email.ignoreUnsubscribe && defaultProps?.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${defaultProps.unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    return {
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      headers,
    };
  });

  try {
    const { data, error } = await resend.batch.send(emailBatch);

    if (error) {
      console.error('Failed to send Resend email:', error);
    } else {
      console.log(
        'Resend emails sent successfully:',
        data?.data?.map(({ id }) => id),
      );
      // Log successful email sends to messages table in a single transaction
      if (data?.data) {
        const emailsToLog = data.data
          .map((result, index) => {
            if (result.id && index < batch.length) {
              return {
                email: batch[index].email,
                from,
                resendId: result.id,
                module,
              };
            }
            return null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (emailsToLog.length > 0) {
          await batchLogEmailToMessages(emailsToLog);
        }
      }
    }
  } catch (error) {
    console.error('Error sending Resend email:', error);
  }
}

/**
 * Sends a batch of templated emails via Resend
 */
export async function $sendEmailBatch<T extends ResendEventType, P extends object>(
  batch: {
    email: TemplatedResendEmail<T, P>;
    defaultProps: DefaultEmailProps;
  }[],
  context: ResendContext,
  extensionTemplates?: ExtensionEmailTemplate[],
  module?: string,
) {
  const emailBatch = await Promise.all(
    batch.map(async ({ email, defaultProps }) => {
      const html = await renderEmailTemplate(
        email.eventType,
        email.templateProps,
        defaultProps,
        extensionTemplates,
      );
      return {
        email: {
          eventType: email.eventType,
          to: email.to,
          subject: email.subject,
          html,
          ignoreUnsubscribe: email.ignoreUnsubscribe,
        },
        defaultProps,
      };
    }),
  );

  await $sendRawEmailBatch(emailBatch, context, module);
}
