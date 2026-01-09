import type { Branding } from '@/types/app-config.js';

export interface DefaultEmailProps {
  asBaseUrl: (path: string) => string;
  unsubscribeUrl?: string;
  branding?: Branding;
}
export const KnownResendEvents = {
  USER_WELCOME: 'USER_WELCOME',
  SUBMISSION_PUBLISHED: 'SUBMISSION_PUBLISHED',
  SITE_INVITATION: 'SITE_INVITATION',
  WORK_INVITATION: 'WORK_INVITATION',
  // PASSWORD_RESET: 'PASSWORD_RESET',
  // EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  ADMIN_TEST: 'ADMIN_TEST',
  USER_APPROVAL_REQUESTED: 'USER_APPROVAL_REQUESTED',
  GENERIC_NOTIFICATION: 'GENERIC_NOTIFICATION',
  HELP_REQUEST: 'HELP_REQUEST',
} as const;

export type KnownResendEventType = (typeof KnownResendEvents)[keyof typeof KnownResendEvents];
export type ResendEventType = KnownResendEventType | string;
