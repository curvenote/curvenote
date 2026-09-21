import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS } from '@curvenote/scms-core';

/** What the `doi` action answers; every card types its fetcher with it. */
export type DoiActionData = { error?: string; info?: string };

/** Placeholder until Sales provides the destination (asked in CN-2508). */
export const CONTACT_SALES_URL = 'https://curvenote.com/contact';
export const CROSSREF_MEMBERSHIP_URL = 'https://www.crossref.org/membership/';
/** Owner shown for Curvenote's own prefix; CURVENOTE_PREFIX rows store no prefix_owner. */
export const CURVENOTE_OWNER_NAME = 'Curvenote Inc.';

type BadgeVariant = 'warning' | 'success' | 'destructive' | 'neutral';

export function statusPresentation(status: string): {
  label: string;
  variant: BadgeVariant;
  description: string;
} {
  if (status === SITE_DOI_CONFIG_STATUS.PENDING_ROLE) {
    return {
      label: 'Waiting for Crossref role',
      variant: 'warning',
      description:
        'Your prefix is saved. Curvenote will link your Crossref role to this Site once your organization has granted access. DOIs cannot be registered until then.',
    };
  }
  if (status === SITE_DOI_CONFIG_STATUS.ACTIVE) {
    return {
      label: 'Active',
      variant: 'success',
      description: 'DOI registration is configured for this Site.',
    };
  }
  if (status === SITE_DOI_CONFIG_STATUS.NEEDS_ATTENTION) {
    return {
      label: 'Needs attention',
      variant: 'destructive',
      description:
        'Crossref no longer accepts this role, so deposits cannot go out until it is checked again. Curvenote has been notified.',
    };
  }
  return { label: status, variant: 'neutral', description: '' };
}

export function methodLabel(mode: string): string {
  return mode === SITE_DOI_CONFIG_MODE.CURVENOTE_PREFIX
    ? 'Curvenote-managed'
    : 'Organization-managed';
}
