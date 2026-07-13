import { userHasScope } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';

type UserWithScopes = Parameters<typeof userHasScope>[0];

export type SubmitTargetSite = {
  name: string;
  external: boolean;
  private: boolean;
  restricted: boolean;
};

export type SubmitSiteCollection = {
  id: string;
  default: boolean;
  open: boolean;
  kindsInCollection: { kind: { id: string; default: boolean } }[];
};

export type SubmitSiteWithCollections = SubmitTargetSite & {
  id: string;
  collections: SubmitSiteCollection[];
  submissionKinds: { id: string; default: boolean }[];
};

export type ExistingSubmissionVersionForSubmit = {
  id: string;
  work_version_id: string;
  status: string;
};

export type SubmitToSiteActionResult = {
  success: true;
  intent: 'submit-to-site';
  siteName: string;
  submissionVersionId: string;
  alreadySubmitted?: true;
};

type ExistingSubmissionForSubmit = {
  id: string;
  versions: ExistingSubmissionVersionForSubmit[];
};

export type SubmitWorkVersionToSiteContext = {
  findExistingSubmission: () => Promise<ExistingSubmissionForSubmit | null>;
};

type SubmitWorkVersionToSiteDeps = {
  createSubmissionVersion: (submissionId: string) => Promise<{ id: string }>;
  createNewSubmissionReturningVersion: () => Promise<{ id: string }>;
};

export class SubmitToSiteConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmitToSiteConfigError';
  }
}

// TEMPORARY(submit-to-site): Remove when per-version submit is supported end-to-end.
export const SUBMIT_TO_SITE_LATEST_VERSION_ONLY_ERROR =
  'Only the latest completed version can be submitted right now. Please contact support if you need to submit an earlier version.';

/** Rejects explicit requests to submit a non-latest completed work version. */
export function getSubmitToSiteLatestVersionPolicyError(
  requestedWorkVersionId: string | undefined,
  latestNonDraftWorkVersionId: string,
): string | null {
  if (!requestedWorkVersionId || requestedWorkVersionId === latestNonDraftWorkVersionId) {
    return null;
  }
  return SUBMIT_TO_SITE_LATEST_VERSION_ONLY_ERROR;
}

/** Stable advisory-lock key for one work submitting to one site. */
export function workSiteSubmitLockKey(workId: string, siteId: string): string {
  return `work-site-submit:${workId}:${siteId}`;
}

/** Pick the submission version for a work version, if any. */
export function findSubmissionVersionForWorkVersion(
  versions: ExistingSubmissionVersionForSubmit[],
  selectedWorkVersionId: string,
): ExistingSubmissionVersionForSubmit | undefined {
  return versions.find((version) => version.work_version_id === selectedWorkVersionId);
}

/** True when this work version is already submitted to the site (non-draft). */
export function isAlreadySubmittedVersion(
  existingVersion: ExistingSubmissionVersionForSubmit | undefined,
  selectedWorkVersionId: string,
): boolean {
  if (!existingVersion || existingVersion.work_version_id !== selectedWorkVersionId) {
    return false;
  }
  return existingVersion.status !== 'DRAFT';
}

async function finishSubmitOnExistingSubmission(
  existingSubmission: ExistingSubmissionForSubmit,
  selectedWorkVersionId: string,
  siteName: string,
  createSubmissionVersion: SubmitWorkVersionToSiteDeps['createSubmissionVersion'],
): Promise<SubmitToSiteActionResult> {
  const existingVersion = findSubmissionVersionForWorkVersion(
    existingSubmission.versions,
    selectedWorkVersionId,
  );
  if (existingVersion && isAlreadySubmittedVersion(existingVersion, selectedWorkVersionId)) {
    return {
      success: true,
      intent: 'submit-to-site',
      siteName,
      submissionVersionId: existingVersion.id,
      alreadySubmitted: true,
    };
  }
  const submissionVersion = await createSubmissionVersion(existingSubmission.id);
  return {
    success: true,
    intent: 'submit-to-site',
    siteName,
    submissionVersionId: submissionVersion.id,
  };
}

/**
 * Idempotent submit: reuse an existing submission or create one.
 * Call inside a transaction that holds `pg_advisory_xact_lock` for the work/site pair.
 */
export async function submitWorkVersionToSite(
  submitCtx: SubmitWorkVersionToSiteContext,
  deps: SubmitWorkVersionToSiteDeps,
  selectedWorkVersionId: string,
  siteName: string,
): Promise<SubmitToSiteActionResult> {
  const existingSubmission = await submitCtx.findExistingSubmission();
  if (existingSubmission) {
    return finishSubmitOnExistingSubmission(
      existingSubmission,
      selectedWorkVersionId,
      siteName,
      deps.createSubmissionVersion,
    );
  }

  const submissionVersion = await deps.createNewSubmissionReturningVersion();
  return {
    success: true,
    intent: 'submit-to-site',
    siteName,
    submissionVersionId: submissionVersion.id,
  };
}

export function canUserSubmitToSite(user: UserWithScopes, site: SubmitTargetSite): boolean {
  if (!site.private && !site.restricted) return true;
  return userHasScope(user, scopes.site.submissions.create, site.name);
}

// TODO(submit-to-site): When a site has multiple open collections (or kinds), let the
// user choose in SubmittedToBar instead of auto-picking here. For now: default-open
// collection, else first open; then default/first kind on that collection, else site kind.
export function resolveOpenCollection(collections: SubmitSiteCollection[]) {
  return (
    collections.find((item) => item.default && item.open) ?? collections.find((item) => item.open)
  );
}

export function resolveSubmissionKind(
  collection: SubmitSiteCollection | undefined,
  submissionKinds: { id: string; default: boolean }[],
) {
  const collectionKinds = collection?.kindsInCollection.map((item) => item.kind) ?? [];
  return (
    collectionKinds.find((item) => item.default) ??
    collectionKinds[0] ??
    submissionKinds.find((item) => item.default) ??
    submissionKinds[0]
  );
}

/** Whether a site can receive a first-time submission for a work (open collection + kind). */
export function canSiteAcceptNewSubmission(
  site: Pick<SubmitSiteWithCollections, 'collections' | 'submissionKinds'>,
): boolean {
  const collection = resolveOpenCollection(site.collections);
  if (!collection) return false;
  return Boolean(resolveSubmissionKind(collection, site.submissionKinds));
}

export function isSiteAvailableForWorkSubmit(
  user: UserWithScopes,
  site: SubmitSiteWithCollections,
  workSubmittedSiteIds: ReadonlySet<string>,
): boolean {
  if (!canUserSubmitToSite(user, site)) return false;
  if (workSubmittedSiteIds.has(site.id)) return true;
  return canSiteAcceptNewSubmission(site);
}
