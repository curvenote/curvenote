import { getPrismaClient, userHasScope } from '@curvenote/scms-server';
import { scopes } from '@curvenote/scms-core';
import { formatDate } from '@curvenote/common';
import { ActivityType } from '@curvenote/scms-db';
import { uuidv7 as uuid } from 'uuidv7';

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

export async function promoteDraftSubmissionVersionToPending(
  userId: string,
  submissionId: string,
  submissionVersion: ExistingSubmissionVersionForSubmit,
) {
  const timestamp = formatDate();
  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.submissionVersion.update({
      where: { id: submissionVersion.id },
      data: {
        status: 'PENDING',
        date_modified: timestamp,
      },
    });
    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by_id: userId,
        activity_type: ActivityType.SUBMISSION_VERSION_STATUS_CHANGE,
        submission_id: submissionId,
        submission_version_id: submissionVersion.id,
        status: 'PENDING',
        work_version_id: submissionVersion.work_version_id,
      },
    });
  });
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
