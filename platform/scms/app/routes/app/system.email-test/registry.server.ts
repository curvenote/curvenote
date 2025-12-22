import type { ResendEventType } from '@curvenote/scms-core';
import { getExtensionEmailTemplates, KnownResendEvents } from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';

export interface EmailTemplateField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'url' | 'textarea' | 'boolean';
  optional?: boolean;
  example: string | boolean;
}

export interface EmailTemplateInfo {
  eventType: ResendEventType;
  name: string;
  description: string;
  fields: EmailTemplateField[];
  exampleSubject: string;
}

export const EMAIL_TEMPLATE_REGISTRY: Record<string, EmailTemplateInfo> = {
  [KnownResendEvents.GENERIC_NOTIFICATION]: {
    eventType: KnownResendEvents.GENERIC_NOTIFICATION,
    name: 'Generic Notification',
    description: 'Email sent when a generic notification is needed',
    exampleSubject: 'Generic Notification',
    fields: [],
  },
  [KnownResendEvents.ADMIN_TEST]: {
    eventType: KnownResendEvents.ADMIN_TEST,
    name: 'Admin Test Email',
    description: 'Test email template for admin testing purposes',
    exampleSubject: 'Test Email from Curvenote',
    fields: [
      {
        name: 'recipient',
        label: 'Recipient Name',
        type: 'text',
        example: 'John Doe',
      },
      {
        name: 'message',
        label: 'Test Message',
        type: 'textarea',
        example: 'This is a test message from the Curvenote admin system',
      },
      {
        name: 'url',
        label: 'URL',
        type: 'url',
        example: '/',
      },
    ],
  },
  [KnownResendEvents.SITE_INVITATION]: {
    eventType: KnownResendEvents.SITE_INVITATION,
    name: 'Site Invitation',
    description: 'Email sent when a user is invited to join a site',
    exampleSubject: "You've been invited to join a site on Curvenote",
    fields: [
      {
        name: 'siteName',
        label: 'Site Name',
        type: 'text',
        example: 'My Journal',
      },
      {
        name: 'siteUrl',
        label: 'Site URL',
        type: 'url',
        example: '/app/sites/my-site',
      },
      {
        name: 'role',
        label: 'Role',
        type: 'text',
        example: 'Author',
      },
      {
        name: 'inviterName',
        label: 'Inviter Name',
        type: 'text',
        example: 'John Doe',
        optional: true,
      },
      {
        name: 'inviterEmail',
        label: 'Inviter Email',
        type: 'email',
        example: 'john@example.com',
        optional: true,
      },
      {
        name: 'recipientName',
        label: 'Recipient Name',
        type: 'text',
        example: 'Jane Doe',
        optional: true,
      },
    ],
  },
  [KnownResendEvents.WORK_INVITATION]: {
    eventType: KnownResendEvents.WORK_INVITATION,
    name: 'Work Invitation',
    description: 'Email sent when a user is invited to join a work',
    exampleSubject: "You've been invited to join a work on Curvenote",
    fields: [
      {
        name: 'workTitle',
        label: 'Work Title',
        type: 'text',
        example: 'My Research Paper',
      },
      {
        name: 'workUrl',
        label: 'Work URL',
        type: 'url',
        example: '/app/works/work-id',
      },
      {
        name: 'role',
        label: 'Role',
        type: 'text',
        example: 'Contributor',
      },
      {
        name: 'inviterName',
        label: 'Inviter Name',
        type: 'text',
        example: 'John Doe',
        optional: true,
      },
      {
        name: 'inviterEmail',
        label: 'Inviter Email',
        type: 'email',
        example: 'john@example.com',
        optional: true,
      },
      {
        name: 'recipientName',
        label: 'Recipient Name',
        type: 'text',
        example: 'Jane Doe',
        optional: true,
      },
    ],
  },
  [KnownResendEvents.USER_APPROVAL_REQUESTED]: {
    eventType: KnownResendEvents.USER_APPROVAL_REQUESTED,
    name: 'User Approval Request',
    description: 'Email sent to admins when a new user requires approval',
    exampleSubject: 'New User Approval Request: John Doe',
    fields: [
      {
        name: 'userDisplayName',
        label: 'User Display Name',
        type: 'text',
        example: 'John Doe',
      },
      {
        name: 'userEmail',
        label: 'User Email',
        type: 'email',
        example: 'john.doe@example.com',
      },
      {
        name: 'userProvider',
        label: 'Sign-up Provider',
        type: 'text',
        example: 'google',
      },
    ],
  },
  [KnownResendEvents.USER_WELCOME]: {
    eventType: KnownResendEvents.USER_WELCOME,
    name: 'Welcome',
    description: 'Email sent to users when they sign up and are able to access the app',
    exampleSubject: 'Welcome to Curvenote!',
    fields: [
      {
        name: 'approval',
        label: 'Approval was required',
        type: 'boolean',
        example: false,
      },
    ],
  },
  [KnownResendEvents.SUBMISSION_PUBLISHED]: {
    eventType: KnownResendEvents.SUBMISSION_PUBLISHED,
    name: 'Submission Published',
    description: 'Email sent to authors when their submission is published',
    exampleSubject: '🎉 Congratulations!',
    fields: [
      {
        name: 'submissionTitle',
        label: 'Submission Title',
        type: 'text',
        example: 'My Research Paper',
      },
      {
        name: 'siteTitle',
        label: 'Site Title',
        type: 'text',
        example: 'My Journal',
      },
      {
        name: 'publishedUrl',
        label: 'Published URL',
        type: 'url',
        example: '/app/works/work-id',
      },
      {
        name: 'authorName',
        label: 'Author Name',
        type: 'text',
        example: 'John Doe',
      },
    ],
  },
};

// Function to get email template registry with extension support
export async function getEmailTemplateRegistry(): Promise<Record<string, EmailTemplateInfo>> {
  const baseRegistry = { ...EMAIL_TEMPLATE_REGISTRY };
  const extensionTemplates = getExtensionEmailTemplates(extensions);

  // Add extension templates to registry dynamically
  for (const template of extensionTemplates) {
    if (!baseRegistry[template.eventType] && template.templateInfo) {
      baseRegistry[template.eventType] = {
        eventType: template.eventType as any,
        name: template.templateInfo.name,
        description: template.templateInfo.description,
        exampleSubject: template.templateInfo.exampleSubject,
        fields: template.templateInfo.fields,
      };
    }
  }

  return baseRegistry;
}
