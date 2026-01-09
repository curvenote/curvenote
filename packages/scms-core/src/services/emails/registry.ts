import { CurvenoteTestEmail } from './test-email.js';
import { SiteInvitationEmail } from './site-invitation.js';
import { WorkInvitationEmail } from './work-invitation.js';
import { UserApprovalRequestedEmail } from './user-approval-requested.js';
import { GenericNotificationEmail } from './generic-notification.js';
import { SubmissionPublishedEmail } from './submission-published.js';
import { RequestHelpEmail } from './request-help.js';
import { KnownResendEvents } from './types.js';
import { WelcomeEmail } from './welcome.js';

// Base email templates (non-extension)
export const baseEmailTemplates: Record<string, any> = {
  [KnownResendEvents.ADMIN_TEST]: CurvenoteTestEmail,
  [KnownResendEvents.SITE_INVITATION]: SiteInvitationEmail,
  [KnownResendEvents.WORK_INVITATION]: WorkInvitationEmail,
  [KnownResendEvents.USER_APPROVAL_REQUESTED]: UserApprovalRequestedEmail,
  [KnownResendEvents.USER_WELCOME]: WelcomeEmail,
  [KnownResendEvents.GENERIC_NOTIFICATION]: GenericNotificationEmail,
  [KnownResendEvents.SUBMISSION_PUBLISHED]: SubmissionPublishedEmail,
  [KnownResendEvents.HELP_REQUEST]: RequestHelpEmail,
};
