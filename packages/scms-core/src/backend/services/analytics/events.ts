/**
 * Analytics event enums for type-safe tracking
 */

export enum TrackEvent {
  // User events
  USER_CREATED = 'User Created',
  USER_SIGNED_UP = 'User Signed Up',
  USER_LOGGED_IN = 'User Logged In',
  USER_LINKED = 'User Linked',
  USER_UNLINKED = 'User Unlinked',
  USER_EMAIL_PREFERENCES_UPDATED = 'User Email Preferences Updated',
  USER_TOKEN_CREATED = 'User Token Created',
  USER_TOKEN_DELETED = 'User Token Deleted',

  // User onboarding events
  USER_APPROVED = 'User Approved',
  USER_REJECTED = 'User Rejected',
  USER_DISABLED = 'User Disabled',
  USER_ENABLED = 'User Enabled',
  USER_READY_FOR_APPROVAL = 'User Ready for Approval',

  // Signup step completion events
  SIGNUP_AGREEMENT_COMPLETED = 'Signup Agreement Completed',
  SIGNUP_DATA_COLLECTION_COMPLETED = 'Signup Data Collection Completed',
  SIGNUP_LINK_PROVIDERS_COMPLETED = 'Signup Link Providers Completed',
  SIGNUP_LINK_PROVIDERS_SKIPPED = 'Signup Link Providers Skipped',

  // Critical failure events
  SIGNUP_STEP_FAILED = 'Signup Step Failed',
  SIGNUP_COMPLETION_FAILED = 'Signup Completion Failed',
  USER_LINKING_FAILED = 'Account Linking Failed',

  // Work events
  WORK_CREATED = 'Work Created',
  WORK_VIEWED = 'Work Viewed',
  WORK_ROLE_GRANTED = 'Work Role Granted',
  WORK_ROLE_REVOKED = 'Work Role Revoked',

  // File events
  FILES_UPLOADED = 'Files Uploaded',
  FILES_STAGED = 'Files Staged',
  FILE_REMOVED = 'File Removed',

  // Submission events
  SUBMISSION_CREATED = 'Submission Created',
  SUBMISSION_VIEWED = 'Submission Viewed',
  SUBMISSION_VERSION_CREATED = 'Submission Version Created',
  SUBMISSION_STATUS_CHANGED = 'Submission Status Changed',
  SUBMISSION_SLUG_SET_AS_PRIMARY = 'Submission Slug Set as Primary',
  SUBMISSION_SLUG_DELETED = 'Submission Slug Deleted',
  SUBMISSION_SLUG_ADDED = 'Submission Slug Added',
  SUBMISSION_KIND_CHANGED = 'Submission Kind Changed',
  SUBMISSION_COLLECTION_CHANGED = 'Submission Collection Changed',
  SUBMISSION_DATE_PUBLISHED_CHANGED = 'Submission Date Published Changed',

  // In-app user behavior
  WELCOME_VIDEO_PLAYED = 'Welcome Video Played',

  // Site request events
  SITE_REQUEST_VIDEO_PLAYED = 'Site Request Video Played',
  SITE_REQUEST_STARTED = 'Site Request Started',
  SITE_REQUEST_COMPLETED = 'Site Request Completed',
  SITE_REQUEST_SENT = 'Site Request Sent',

  // Site events
  SITE_CREATED = 'Site Created',

  // Site design events
  SITE_DESIGN_UPDATED = 'Site Design Updated',

  // Magic link events
  MAGIC_LINK_CREATED = 'Magic Link Created',
  MAGIC_LINK_ACCESSED = 'Magic Link Accessed',
  MAGIC_LINK_ACCESS_FAILED = 'Magic Link Access Failed',
  MAGIC_LINK_REVOKED = 'Magic Link Revoked',
  MAGIC_LINK_REACTIVATED = 'Magic Link Reactivated',
  MAGIC_LINK_DELETED = 'Magic Link Deleted',

  // Navigation events
  NAVIGATE = 'Navigate',
}

// Extension event types - using string literals for now to avoid import type issues
export type ExtensionTrackEvent = string;

// Combined event types for analytics infrastructure
export type AllTrackEvent = TrackEvent | ExtensionTrackEvent;

export const TrackEventDescriptions: Record<TrackEvent, string> = {
  // User events
  [TrackEvent.USER_CREATED]: 'User account created',
  [TrackEvent.USER_SIGNED_UP]: 'User signed up for the first time',
  [TrackEvent.USER_LOGGED_IN]: 'User logged into the system',
  [TrackEvent.USER_LINKED]: 'User linked an external account',
  [TrackEvent.USER_UNLINKED]: 'User unlinked an external account',
  [TrackEvent.USER_EMAIL_PREFERENCES_UPDATED]: 'User updated email notification preferences',
  [TrackEvent.USER_TOKEN_CREATED]: 'User created an API token',
  [TrackEvent.USER_TOKEN_DELETED]: 'User deleted an API token',

  // User onboarding events
  [TrackEvent.USER_APPROVED]: 'User account was approved by admin',
  [TrackEvent.USER_REJECTED]: 'User account was rejected by admin',
  [TrackEvent.USER_DISABLED]: 'User account was disabled',
  [TrackEvent.USER_ENABLED]: 'User account was enabled',
  [TrackEvent.USER_READY_FOR_APPROVAL]: 'User completed signup and is ready for approval',

  // Signup step completion events
  [TrackEvent.SIGNUP_AGREEMENT_COMPLETED]: 'User completed the agreement step in signup',
  [TrackEvent.SIGNUP_DATA_COLLECTION_COMPLETED]:
    'User completed the data collection step in signup',
  [TrackEvent.SIGNUP_LINK_PROVIDERS_COMPLETED]: 'User completed the link providers step in signup',
  [TrackEvent.SIGNUP_LINK_PROVIDERS_SKIPPED]: 'User skipped the link providers step in signup',

  // Critical failure events
  [TrackEvent.SIGNUP_STEP_FAILED]: 'A signup step failed to complete',
  [TrackEvent.SIGNUP_COMPLETION_FAILED]: 'Signup completion process failed',
  [TrackEvent.USER_LINKING_FAILED]: 'Account linking process failed',

  // Work events
  [TrackEvent.WORK_CREATED]: 'New work created',
  [TrackEvent.WORK_VIEWED]: 'Work details page viewed',
  [TrackEvent.WORK_ROLE_GRANTED]: 'User role granted on a work',
  [TrackEvent.WORK_ROLE_REVOKED]: 'User role revoked from a work',

  // File events
  [TrackEvent.FILES_UPLOADED]: 'Files uploaded to a work',
  [TrackEvent.FILES_STAGED]: 'Files staged for upload',
  [TrackEvent.FILE_REMOVED]: 'File removed from a work',

  // Submission events
  [TrackEvent.SUBMISSION_CREATED]: 'New submission created',
  [TrackEvent.SUBMISSION_VIEWED]: 'Submission details page viewed',
  [TrackEvent.SUBMISSION_VERSION_CREATED]: 'New version added to submission',
  [TrackEvent.SUBMISSION_STATUS_CHANGED]: 'Submission status changed in workflow',
  [TrackEvent.SUBMISSION_SLUG_SET_AS_PRIMARY]: 'Submission slug set as primary',
  [TrackEvent.SUBMISSION_SLUG_DELETED]: 'Submission slug deleted',
  [TrackEvent.SUBMISSION_SLUG_ADDED]: 'New slug added to submission',
  [TrackEvent.SUBMISSION_KIND_CHANGED]: 'Submission kind/type changed',
  [TrackEvent.SUBMISSION_COLLECTION_CHANGED]: 'Submission moved to different collection',
  [TrackEvent.SUBMISSION_DATE_PUBLISHED_CHANGED]: 'Submission published date updated',

  // In-app user behavior
  [TrackEvent.WELCOME_VIDEO_PLAYED]: 'Welcome video played',

  // Site request events
  [TrackEvent.SITE_REQUEST_VIDEO_PLAYED]: 'User played the site request video',
  [TrackEvent.SITE_REQUEST_STARTED]: 'User opened the site request modal',
  [TrackEvent.SITE_REQUEST_COMPLETED]: 'User submitted the site request form',
  [TrackEvent.SITE_REQUEST_SENT]: 'Site request was successfully sent to admin',

  // Site events
  [TrackEvent.SITE_CREATED]: 'New site created',

  // Site design events
  [TrackEvent.SITE_DESIGN_UPDATED]: 'Site design and branding settings updated',

  // Magic link events
  [TrackEvent.MAGIC_LINK_CREATED]: 'Magic link created',
  [TrackEvent.MAGIC_LINK_ACCESSED]: 'Magic link successfully accessed',
  [TrackEvent.MAGIC_LINK_ACCESS_FAILED]: 'Magic link access failed',
  [TrackEvent.MAGIC_LINK_REVOKED]: 'Magic link revoked',
  [TrackEvent.MAGIC_LINK_REACTIVATED]: 'Magic link reactivated',
  [TrackEvent.MAGIC_LINK_DELETED]: 'Magic link deleted',

  // Navigation events
  [TrackEvent.NAVIGATE]: 'User navigated to a page',
};
