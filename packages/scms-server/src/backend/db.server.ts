import { getPrismaClient } from './prisma.server.js';
import { formatDate } from '@curvenote/common';
import type {
  JobDBO,
  SiteDBO,
  UserDBO,
  UserWithRolesDBO,
  WorkDBO,
  WorkVersionDBO,
} from './db.types.js';
import type { SubmissionVersion, WorkVersion } from '@prisma/client';
import { ActivityType, Prisma, WorkRole } from '@prisma/client';
import { error401, httpError, WorkContents, TrackEvent, scopes } from '@curvenote/scms-core';
import { userHasScope } from './scopes.helpers.server.js';
import { uuidv7 } from 'uuidv7';
import { KnownBuckets } from './storage/constants.server.js';
import { Folder, StorageBackend } from './storage/index.js';
import { getUserById, type SecureContext } from './context.server.js';

export async function listAllSites(): Promise<SiteDBO[]> {
  const prisma = await getPrismaClient();
  return prisma.site.findMany();
}

export async function checkSiteExists(name: string): Promise<boolean> {
  const prisma = await getPrismaClient();
  return (await prisma.site.count({ where: { name } })) > 0;
}

export async function checkWorkExists(id: string): Promise<boolean> {
  const prisma = await getPrismaClient();
  return (await prisma.work.count({ where: { id } })) > 0;
}

/**
 * Based on the id, ensure that a user exists in the database.
 *
 * @param id
 * @param email
 * @param opts
 * @returns
 */
export async function ensureUser(
  id: string,
  email: string,
  displayName?: string,
): Promise<UserWithRolesDBO> {
  const existing = await getUserById(id);
  if (existing) return existing;

  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  const user = prisma.user.create({
    data: {
      id,
      date_created: timestamp,
      date_modified: timestamp,
      email,
      display_name: displayName,
      system_role: 'USER',
    },
    include: {
      site_roles: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
        },
      },
      work_roles: true,
      linkedAccounts: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  return user;
}

function flattenWorkAndVersion(work: WorkDBO, version: WorkVersionDBO) {
  const {
    cdn_key,
    cdn,
    title,
    description,
    authors,
    date,
    doi,
    date_created,
    canonical,
    draft,
    metadata,
  } = version;
  return {
    ...work,
    version_id: version.id,
    cdn_key,
    cdn,
    title,
    description,
    authors,
    date,
    doi,
    date_created,
    canonical,
    draft,
    metadata,
  };
}

/**
 * Flatten the work and a version into a single object.
 * If no version is marked as canonical, the latest version is used.
 *
 * @param work
 * @param sortedVersions - assumed already sorted by date_created
 * @returns A WorkWithFlatVersion object
 */
export function flattenWorkAndVersions(work: WorkDBO, sortedVersions: WorkVersionDBO[]) {
  let version = sortedVersions.find((v) => v.canonical);
  if (!version) version = sortedVersions[0];
  return flattenWorkAndVersion(work, version);
}

/**
 * finds the work by id and returns data based on the canonical version
 * If no version is marked as canonical, the latest version is used
 *
 * @param id
 * @returns
 */
export async function findWorkById(id: string, opts?: { forceCanonical?: boolean }) {
  const prisma = await getPrismaClient();
  const work = await prisma.work.findFirst({
    where: { id },
    include: {
      versions: {
        orderBy: {
          date_created: 'desc',
        },
      },
    },
  });

  if (!work) return null;

  let version = work.versions.find((v) => v.canonical);
  if (!version && opts?.forceCanonical) return null;

  if (!version) version = work.versions[0];

  return flattenWorkAndVersion(work, version);
}

export async function findWorkByVersion(versionId: string) {
  const prisma = await getPrismaClient();
  const version = await prisma.workVersion.findUnique({
    where: {
      id: versionId,
    },
    include: {
      work: true,
    },
  });

  if (!version) return null;

  return flattenWorkAndVersion(version.work, version);
}

export async function findDefaultSubmissionForWorkVersion(versionId: string) {
  const prisma = await getPrismaClient();
  return await prisma.submission.findFirst({
    where: {
      versions: {
        some: {
          work_version: {
            id: versionId,
          },
        },
      },
    },
    include: {
      versions: {
        where: {
          work_version: {
            id: versionId,
          },
        },
        orderBy: {
          date_created: 'desc',
        },
        take: 1,
      },
      site: true,
    },
  });
}

/**
 * Updates submission version when status change occurs
 */
export async function $updateSubmissionVersion(
  userId: string,
  submissionVersionId: string,
  data: {
    status: string;
    transition?: Prisma.JsonValue;
    date_published?: string;
    jobId?: string;
  },
) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.submissionVersion.update({
      where: {
        id: submissionVersionId,
      },
      data: {
        status: data.status,
        date_published: data.date_published,
        transition: data.transition == null ? Prisma.JsonNull : data.transition,
        job_id: data.jobId,
      },
      include: {
        work_version: true,
        submission: {
          include: {
            slugs: true,
            site: {
              include: {
                submissionKinds: true,
                collections: true,
                domains: true,
              },
            },
            work: true,
          },
        },
      },
    });

    if (data.date_published && !updated.submission.date_published) {
      await tx.submission.update({
        where: {
          id: updated.submission_id,
        },
        data: {
          date_published: data.date_published,
        },
      });
    }

    const timestamp = new Date().toISOString();
    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: userId,
          },
        },
        submission: {
          connect: {
            id: updated.submission_id,
          },
        },
        submission_version: {
          connect: {
            id: submissionVersionId,
          },
        },
        status: data.status,
        activity_type: ActivityType.SUBMISSION_VERSION_STATUS_CHANGE,
      },
      include: {
        kind: true,
        activity_by: true,
        work_version: { include: { work: true } },
        submission_version: true,
      },
    });

    return updated;
  });
}

export async function updateSubmissionKind(
  user: UserWithRolesDBO,
  submissionId: string,
  update: { kindId: string },
) {
  const prisma = await getPrismaClient();
  const existing = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      kind: { select: { id: true } },
      versions: { select: { id: true } },
      site: { select: { name: true } },
    },
  });
  if (!existing) throw httpError(404, `Submission not found`);

  if (
    existing.submitted_by_id !== user.id &&
    !userHasScope(user, scopes.site.submissions.update, existing.site.name)
  )
    throw error401();

  // TODO: scopes!
  return prisma.$transaction(async (tx) => {
    const { kindId } = update;

    const updated = await tx.submission.update({
      where: {
        id: submissionId,
      },
      data: {
        kind: {
          connect: {
            id: kindId ?? existing.kind.id,
          },
        },
      },
      include: {
        kind: true,
        submitted_by: true,
        site: true,
        versions: {
          include: {
            work_version: true,
          },
        },
      },
    });

    const timestamp = new Date().toISOString();
    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: user.id,
          },
        },
        submission: {
          connect: {
            id: submissionId,
          },
        },
        submission_version: {
          connect: {
            id: updated.versions[0].id,
          },
        },
        activity_type: ActivityType.SUBMISSION_KIND_CHANGE,
        kind: {
          connect: {
            id: kindId ?? existing.kind.id,
          },
        },
      },
      include: {
        activity_by: true,
        kind: true,
      },
    });

    return updated;
  });
}

export async function findJobById(id: string): Promise<JobDBO | null> {
  const prisma = await getPrismaClient();
  return prisma.job.findUnique({
    where: { id },
  });
}

export async function dbCreateDraftWork(
  ctx: SecureContext,
  title: string,
  description: string,
  authors: string[],
  contains: WorkContents[],
  metadata?: Record<string, any>,
) {
  const date_created = new Date().toISOString();
  const prisma = await getPrismaClient();
  const workId = uuidv7();
  const workVersionId = uuidv7();

  const backend = new StorageBackend(ctx, [KnownBuckets.prv]);

  const cdnKey = uuidv7();

  return prisma.$transaction(async (tx) => {
    // Create the work with files content type
    const newWork = await tx.work.create({
      data: {
        id: workId,
        date_created,
        date_modified: date_created,
        contains,
        created_by: {
          connect: {
            id: ctx.user.id,
          },
        },
        versions: {
          create: [
            {
              id: workVersionId,
              date_created,
              date_modified: date_created,
              cdn: backend.cdnFromKnownBucket(KnownBuckets.prv),
              cdn_key: cdnKey,
              title,
              description,
              draft: true,
              authors,
              metadata: metadata ?? {},
            },
          ],
        },
        work_users: {
          create: [
            {
              id: uuidv7(),
              date_created,
              date_modified: date_created,
              user_id: ctx.user.id,
              role: WorkRole.OWNER,
            },
          ],
        },
      },
      include: {
        versions: true,
      },
    });

    // Create activity record
    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created,
        date_modified: date_created,
        activity_by: {
          connect: {
            id: ctx.user.id,
          },
        },
        activity_type: ActivityType.NEW_WORK,
        work: {
          connect: {
            id: workId,
          },
        },
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
      },
    });

    return newWork;
  });
}

/**
 * Helper to create a new draft file work with checks metadata
 * This is a convenience wrapper around dbCreateDraftWork specifically for file upload workflows
 */
export async function dbCreateDraftFileWork(ctx: SecureContext, source: string = 'unknown') {
  const newWork = await dbCreateDraftWork(
    ctx,
    '', // Empty title - indicates untouched
    '', // Empty description
    [], // No authors yet
    [WorkContents.FILES], // This is a files work
    { checks: {} }, // Initialize with checks field
  );

  await ctx.trackEvent(TrackEvent.WORK_CREATED, {
    workId: newWork.id,
    workVersionId: newWork.versions[0].id,
    contains: newWork.contains,
    isDraft: true,
    source,
  });

  return newWork;
}

export async function dbCreateDraftSubmission(
  user: UserDBO,
  work: Awaited<ReturnType<typeof dbCreateDraftWork>>,
  siteName: string,
) {
  const prisma = await getPrismaClient();
  const date_created = formatDate();

  return prisma.$transaction(async (tx) => {
    // Find the requested site and its default submission kind / collection
    const site = await tx.site.findUnique({
      where: { name: siteName },
      include: {
        submissionKinds: {
          where: { default: true },
          take: 1,
        },
        collections: {
          where: { default: true },
          take: 1,
        },
      },
    });

    if (!site) throw new Error(`Site ${siteName} not found`);
    if (!site.submissionKinds[0])
      throw new Error(`No default submission kind found for site ${siteName}`);
    if (!site.collections[0]) throw new Error(`No default collection found for site ${siteName}`);

    const submissionId = uuidv7();
    const submissionVersionId = uuidv7();

    // Create the submission with a draft version
    const submission = await tx.submission.create({
      data: {
        id: submissionId,
        date_created,
        date_modified: date_created,
        submitted_by: {
          connect: {
            id: user.id,
          },
        },
        kind: {
          connect: {
            id: site.submissionKinds[0].id,
          },
        },
        site: {
          connect: {
            id: site.id,
          },
        },
        collection: {
          connect: {
            id: site.collections[0].id,
          },
        },
        work: {
          connect: {
            id: work.id,
          },
        },
        versions: {
          create: [
            {
              id: submissionVersionId,
              date_created,
              date_modified: date_created,
              status: 'DRAFT',
              submitted_by: {
                connect: { id: user.id },
              },
              work_version: {
                connect: { id: work.versions[0].id },
              },
            },
          ],
        },
      },
      include: {
        kind: true,
        collection: true,
        versions: true,
      },
    });

    const timestamp = new Date().toISOString();
    // Create activity record
    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: user.id,
          },
        },
        activity_type: ActivityType.NEW_SUBMISSION,
        submission: {
          connect: {
            id: submissionId,
          },
        },
        submission_version: {
          connect: {
            id: submissionVersionId,
          },
        },
      },
    });

    return submission;
  });
}

/**
 * DANGEROUS: Delete all files associated with work versions using folder abstraction
 *
 * This function permanently deletes entire folders from CDN storage based on work version's
 * cdn_key paths. It uses the Folder abstraction for efficient bulk deletion of all files
 * within each work version's storage directory.
 *
 * @param ctx - The secure context containing user authentication and storage configuration
 * @param workVersions - Array of work versions whose files should be deleted
 *
 * @returns {Promise<void>} Resolves when all folder deletions are complete
 *
 * @example
 * ```typescript
 * await dangerouslyDeleteAllWorkVersionFiles(ctx, draftWorkVersions);
 * ```
 *
 * @description
 * For each work version:
 * 1. Validates work version has required cdn and cdn_key properties
 * 2. Creates Folder instance using work version's cdn_key as the folder path
 * 3. Checks if folder exists in storage
 * 4. Deletes entire folder and all contents if it exists
 * 5. Continues with next work version even if deletion fails for one
 *
 * SAFETY FEATURES:
 * - Skips work versions missing cdn or cdn_key (defensive programming)
 * - Checks folder existence before attempting deletion
 * - Individual error handling per work version (one failure doesn't stop others)
 * - Detailed logging for successful deletions, warnings, and errors
 *
 * WARNING: This function performs PERMANENT folder deletions that cannot be undone.
 * All files within each work version's cdn_key folder will be irreversibly lost.
 * Use only when you are certain the work versions and their files should be deleted.
 */
async function dangerouslyDeleteAllWorkVersionFiles(
  ctx: SecureContext,
  workVersions: WorkVersion[],
) {
  for (const workVersion of workVersions) {
    if (!workVersion.cdn || !workVersion.cdn_key) {
      continue;
    }

    const cdn = workVersion.cdn;
    const cdnKey = workVersion.cdn_key;

    try {
      const backend = new StorageBackend(ctx, [
        KnownBuckets.prv,
        KnownBuckets.pub,
        KnownBuckets.tmp,
      ]);

      const bucket = backend.knownBucketFromCDN(cdn);
      const folder = new Folder(backend, cdnKey, bucket);

      const exists = await folder.exists();
      if (exists) {
        await folder.delete();
        console.log(`Successfully deleted folder ${cdnKey} for work version ${workVersion.id}`);
      } else {
        console.warn(
          `Folder ${cdnKey} does not exist in storage for work version ${workVersion.id}`,
        );
      }
    } catch (error) {
      console.error(`Error deleting folder ${cdnKey} for work version ${workVersion.id}:`, error);
      // Continue with other work versions even if one fails
    }
  }
}

/**
 * DANGEROUS: Delete draft submission versions and optionally associated draft work versions
 *
 * This function permanently deletes draft submission versions for works.
 * It can optionally also delete associated draft work versions based on the
 * `deleteDraftWorkVersions` flag. It handles file cleanup from CDN storage and
 * uses database transactions to ensure data integrity.
 *
 * @param ctx - The secure context containing user authentication and configuration
 * @param siteName - The name of the site to delete the draft deposit from
 * @param workId - The ID of the work containing the draft deposit to delete
 * @param userId - The ID of the user attempting to delete the work (for access control)
 * @param opts - Options object with `deleteDraftWorkVersions` flag (defaults to false)
 *
 * @throws {Error} When work is not found or user lacks access permissions
 * @throws {Error} When no draft versions are found to delete
 *
 * @returns {Promise<void>} Resolves when deletion is complete
 *
 * @example
 * ```typescript
 * // Delete only draft submission versions
 * await dangerousHardDeleteDraftSubmissionVersions(ctx, 'abc', 'work-123', 'user-456');
 *
 * // Delete draft submission versions AND draft work versions (if safe to do so)
 * await dangerousHardDeleteDraftSubmissionVersions(ctx, 'abc', 'work-123', 'user-456', { deleteDraftWorkVersions: true });
 * ```
 *
 * @description
 * The deletion process follows this order:
 * 1. Validates work exists and user has access to submissions only for the specified site
 * 2. Identifies draft submission versions for the specified site specifically
 * 3. Maps to associated draft work versions through submission version relationships
 * 4. Uses database transaction to delete in safe order (respecting foreign key constraints):
 *    - Always: Delete draft submission versions first
 *    - Always: Delete empty submissions (using relationship filters for efficiency)
 *    - Conditionally: Delete draft work versions ONLY if `deleteDraftWorkVersions` is true AND work version has no other submission version references
 *    - Conditionally: Check for work with no remaining versions, then delete work_users first and work second
 * 5. After successful transaction: Delete associated files from CDN storage (only if `deleteDraftWorkVersions` is true)
 *
 * SAFETY FEATURES:
 * - Files are deleted AFTER database transaction to prevent orphaned database records if transaction fails
 * - Work versions only deleted if they have NO other submission version references (prevents data loss)
 * - Work deletion uses relationship filters to ensure no versions remain
 * - Foreign key constraints respected by deleting work_users before work
 * - Site-specific query optimization (only loads relevant submission data, not all work data)
 * - Multiple protection layers prevent accidental deletion of referenced data
 *
 * WARNING: This function performs DANGEROUS hard deletions that cannot be undone.
 * It is specific to the site use case for cleaning up draft deposits.
 * Multiple safety checks are in place, but data will be permanently lost.
 * The conditional work version deletion allows for selective cleanup depending on the context.
 */
export async function dangerouslyHardDeleteDraftSubmissionVersions(
  ctx: SecureContext,
  siteName: string,
  workId: string,
  userId: string,
  opts: { deleteDraftWorkVersions: boolean } = { deleteDraftWorkVersions: false },
) {
  const prisma = await getPrismaClient();

  // Get the work with all its versions and submissions
  const work = await prisma.work.findFirst({
    where: {
      id: workId,
      work_users: {
        some: {
          user_id: userId,
        },
      },
    },
    include: {
      submissions: {
        where: {
          site: {
            name: siteName,
          },
        },
        include: {
          versions: {
            include: {
              work_version: true, // only include work versions related to this submission version
            },
          },
        },
      },
    },
  });

  if (!work) {
    throw new Error('Work not found or access denied');
  }

  // Identify draft submission versions and associated draft work versions
  const draftSubmissionVersions = work.submissions.flatMap((s: any) =>
    s.versions.filter((sv: SubmissionVersion) => sv.status === 'DRAFT'),
  );
  const draftWorkVersions = draftSubmissionVersions
    .map((sv: any) => sv.work_version)
    .filter((wv: WorkVersion) => wv && wv.draft === true);
  // TODO: we may need to drop the above filter to ensure we delete all draft work versions
  // that were created by draft submissions from the CLI

  if (draftWorkVersions.length === 0 && draftSubmissionVersions.length === 0) {
    throw new Error('No draft versions found to delete');
  }

  // Delete in the correct order to handle foreign key constraints
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Delete draft submission versions first
    for (const submissionVersion of draftSubmissionVersions) {
      await tx.submissionVersion.delete({
        where: { id: submissionVersion.id },
      });
    }

    await tx.submission.deleteMany({
      where: {
        work_id: workId,
        site: { name: siteName },
        versions: {
          none: {}, // This checks if the submission has no versions
        },
      },
    });

    if (opts.deleteDraftWorkVersions) {
      // Delete draft work versions only if they are not referenced by any other submission versions
      for (const workVersion of draftWorkVersions) {
        await tx.workVersion.deleteMany({
          where: { id: workVersion.id, submissionVersions: { none: {} } },
        });
      }

      // First check if work has no versions, then delete work_users and work
      const workWithNoVersions = await tx.work.findFirst({
        where: {
          id: workId,
          versions: {
            none: {}, // Only proceed if work has no versions
          },
        },
      });

      if (workWithNoVersions) {
        // Delete work users first (foreign key constraint)
        await tx.workUser.deleteMany({
          where: { work_id: workId },
        });

        // Then delete the work
        await tx.work.delete({
          where: { id: workId },
        });
      }
    }
  });

  if (opts.deleteDraftWorkVersions) {
    // Delete files from CDN storage for draft work versions if requested
    // AND if the database transaction was successful
    await dangerouslyDeleteAllWorkVersionFiles(ctx, draftWorkVersions);
  }
}
