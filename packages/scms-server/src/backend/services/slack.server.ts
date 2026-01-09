import type { Slack } from '@/types/app-config.js';

export enum SlackEventType {
  USER_CREATED = 'USER_CREATED',
  USER_TOKEN_CREATED = 'USER_TOKEN_CREATED',
  USER_TOKEN_DELETED = 'USER_TOKEN_DELETED',
  SUBMISSION_VERSION_CREATED = 'SUBMISSION_VERSION_CREATED',
  SUBMISSION_STATUS_CHANGED = 'SUBMISSION_STATUS_CHANGED',
  SITE_CREATED = 'SITE_CREATED',
  SITE_ROLE_GRANTED = 'SITE_ROLE_GRANTED',
  SITE_ROLE_REVOKED = 'SITE_ROLE_REVOKED',
  SITE_REQUEST_SENT = 'SITE_REQUEST_SENT',
}

export interface SlackMessage {
  eventType: SlackEventType;
  message: string;
  user?: { id?: string; email?: string | null };
  color?: 'good' | 'warning' | 'danger';
  metadata?: Record<string, any>;
}

/**
 * Sends a Slack notification with structured metadata
 */
export async function $sendSlackNotification(message: SlackMessage, slackConfig?: Slack) {
  if (process.env.NODE_ENV !== 'test') {
    console.log('Slack notification:', {
      eventType: message.eventType,
      message: message.message,
      metadata: message.metadata,
    });
  }
  if (!slackConfig?.webhookUrl) {
    console.log('Slack webhook URL not configured');
    return;
  }
  if (slackConfig.disabled) {
    console.log('Slack notifications disabled');
    return;
  }

  const text = `${process.env.VERCEL_ENV !== 'production' ? '*[DEV]* ' : ''}${message.message}`;

  const fields = [
    {
      title: 'Event Type',
      value: message.eventType,
      short: true,
    },
    {
      title: 'Timestamp',
      value: new Date().toISOString(),
      short: true,
    },
  ];
  if (message.user?.id) {
    fields.push({
      title: 'User Id',
      value: message.user.id,
      short: !!message.user.email,
    });
  }
  if (message.user?.email) {
    fields.push({
      title: 'User Email',
      value: message.user.email,
      short: !!message.user.id,
    });
  }
  if (message.metadata) {
    fields.push(
      ...Object.entries(message.metadata).map(([key, raw]) => {
        const value = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
        return {
          title: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
          value,
          short: value.length < 30,
        };
      }),
    );
  }
  const payload = {
    text,
    // Attachments are a legacy feature, but easier than `blocks` for arbitrary metadata.
    attachments: [
      {
        color: message.color || 'good',
        fields,
      },
    ],
  };

  try {
    const response = await fetch(slackConfig.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.status, response.statusText);
    } else {
      console.log('Slack notification sent successfully');
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}
