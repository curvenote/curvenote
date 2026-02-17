/**
 * Canonical display labels for activity types. Used by submission activity feeds
 * (ee/sites) and work timeline (platform/scms) so labels are defined once.
 */
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  NEW_SUBMISSION: 'New submission',
  SUBMISSION_KIND_CHANGE: 'Submission kind changed',
  SUBMISSION_DATE_CHANGE: 'Submission publication date changed',
  SUBMISSION_VERSION_ADDED: 'New submission version',
  SUBMISSION_VERSION_STATUS_CHANGE: 'Submission version status changed',
  SUBMISSION_VERSION_TRANSITION_STARTED: 'Submission version transition started',
  NEW_WORK: 'New Work',
  WORK_VERSION_ADDED: 'New work version',
  DRAFT_WORK_VERSION_STARTED: 'Draft work version started',
  CONVERTER_TASK_STARTED: 'Converter task started',
  CHECK_STARTED: 'Check started',
  KIND_CREATED: 'New submission kind',
  KIND_DELETED: 'Submission kind deleted',
  KIND_UPDATED: 'Submission kind updated',
  SITE_CONTENT_UPDATED: 'Site landing content updated',
  COLLECTION_CREATED: 'New collection',
  COLLECTION_DELETED: 'Collection deleted',
  COLLECTION_UPDATED: 'Collection updated',
  FORM_CREATED: 'Form created',
  FORM_DELETED: 'Form deleted',
  FORM_UPDATED: 'Form updated',
  FORM_SUBMITTED: 'Form submitted',
  USER_ENABLED: 'User enabled',
  USER_DISABLED: 'User disabled',
  USER_APPROVED: 'User approved',
  USER_REJECTED: 'User rejected',
  ACCESS_GRANTED: 'Access granted',
  ACCESS_REVOKED: 'Access revoked',
  ROLE_CREATED: 'Role created',
  ROLE_UPDATED: 'Role updated',
  ROLE_DELETED: 'Role deleted',
  ROLE_ASSIGNED: 'Role assigned',
  ROLE_REMOVED: 'Role removed',
};

/** Format check kind id for display (e.g. proofig → Proofig, curvenote-structure → Curvenote structure). */
export function formatCheckKind(checkKind: string): string {
  const normalized = checkKind.replace(/-/g, ' ').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Resolve an activity type (and optional data/transition payload) to a display label.
 * Use this in activity feeds and timelines so labels stay in one place.
 * CHECK_STARTED: use options.data?.check?.kind for check kind.
 * CONVERTER_TASK_STARTED: use options.data?.converter?.target and options.data?.converter?.type.
 */
export function getActivityTypeLabel(
  activityType: string,
  options?: {
    data?: Record<string, unknown> | null;
    transition?: Record<string, unknown> | null;
  },
): string {
  const checkFromData =
    options?.data && typeof (options.data.check as { kind?: string })?.kind === 'string'
      ? (options.data.check as { kind: string }).kind
      : null;
  const checkFromTransition =
    typeof options?.transition?.checkKind === 'string' ? options.transition.checkKind : null;
  const checkKind = checkFromData ?? checkFromTransition;
  if (activityType === 'CHECK_STARTED' && checkKind) {
    return `${formatCheckKind(checkKind)} check started`;
  }
  const converter = options?.data?.converter as { target?: string; type?: string } | undefined;
  if (activityType === 'CONVERTER_TASK_STARTED' && converter) {
    const target = converter.target ?? 'document';
    const type = converter.type ?? '';
    const suffix = type ? ` (${type})` : '';
    return `${target} conversion${suffix} started`;
  }
  return ACTIVITY_TYPE_LABELS[activityType] ?? activityType.replace(/_/g, ' ').toLowerCase();
}
