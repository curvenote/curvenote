import { getPrismaClient, Folder, StorageBackend, KnownBuckets } from '@curvenote/scms-server';
import type { $Enums, WorkVersion } from '@curvenote/scms-db';
import type { SecureContext } from '@curvenote/scms-server';

export async function dbGetWorksAndSubmissionVersions(userId: string) {
  const prisma = await getPrismaClient();
  const works = await prisma.work.findMany({
    where: {
      work_users: {
        some: {
          user_id: userId,
        },
      },
    },
    include: {
      work_users: {
        where: {
          user_id: userId,
        },
        select: {
          role: true,
        },
      },
      submissions: {
        include: {
          site: true,
          slugs: true,
          collection: true,
          activity: {
            include: {
              activity_by: true,
            },
            orderBy: {
              date_created: 'desc',
            },
            take: 1,
          },
          versions: {
            include: {
              submission: {
                include: {
                  site: true,
                  collection: true,
                },
              },
              work_version: true,
            },
            orderBy: {
              date_created: 'desc',
            },
          },
        },
      },
      versions: {
        orderBy: {
          date_created: 'desc',
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
    take: 50,
  });

  // Transform works to include the user's role with precedence handling
  return works.map((work) => {
    // Get the highest precedence role: OWNER > CONTRIBUTOR > VIEWER
    const userRoles = work.work_users.map((wu) => wu.role);
    let userRole: $Enums.WorkRole | 'ORPHANED' = 'ORPHANED';

    if (userRoles.includes('OWNER')) {
      userRole = 'OWNER';
    } else if (userRoles.includes('CONTRIBUTOR')) {
      userRole = 'CONTRIBUTOR';
    } else if (userRoles.includes('VIEWER')) {
      userRole = 'VIEWER';
    }

    // Extract unique sites for filter counting
    const sites = [...new Set(work.submissions.map((sub) => sub.site.name))].filter(Boolean);

    return {
      ...work,
      userRole,
      sites,
    };
  });
}

/**
 * Helper function to delete files associated with work versions
 * Deletes entire folders from CDN storage based on work version's cdn_key paths
 */
async function deleteWorkVersionFiles(ctx: SecureContext, workVersions: WorkVersion[]) {
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
 * DANGEROUS: Delete a draft work and all its associated data
 *
 * This function permanently deletes a draft work that has no submissions.
 * It handles deletion of work versions, work users, the work itself, and associated files.
 *
 * @param ctx - The secure context containing user authentication and configuration
 * @param workId - The ID of the work to delete
 * @param userId - The ID of the user attempting to delete the work (for access control)
 *
 * @throws {Error} When work is not found, user lacks access, or work has submissions
 * @throws {Error} When work is not a draft
 *
 * @returns {Promise<void>} Resolves when deletion is complete
 *
 * @example
 * ```typescript
 * await dangerouslyDeleteDraftWork(ctx, 'work-123', 'user-456');
 * ```
 *
 * @description
 * The deletion process follows this order:
 * 1. Validates work exists and user has OWNER access
 * 2. Ensures work has NO submissions (safety check)
 * 3. Ensures all work versions are drafts (safety check)
 * 4. Uses database transaction to delete in safe order:
 *    - Delete work versions
 *    - Delete work_users (foreign key constraint)
 *    - Delete the work itself
 * 5. After successful transaction: Delete associated files from CDN storage
 *
 * SAFETY FEATURES:
 * - Only allows deletion if user is OWNER of the work
 * - Prevents deletion if work has any submissions
 * - Only deletes works where ALL versions are drafts
 * - Files are deleted AFTER database transaction to prevent orphaned records
 * - Foreign key constraints respected by deleting work_users before work
 *
 * WARNING: This function performs DANGEROUS hard deletions that cannot be undone.
 * Use only for cleaning up draft works without submissions.
 */
export async function dangerouslyDeleteDraftWork(
  ctx: SecureContext,
  workId: string,
  userId: string,
) {
  const prisma = await getPrismaClient();

  // Get the work with all its versions and check for submissions
  const work = await prisma.work.findFirst({
    where: {
      id: workId,
      work_users: {
        some: {
          user_id: userId,
          role: 'OWNER', // Only owners can delete
        },
      },
    },
    include: {
      versions: true,
      submissions: true, // Check if work has any submissions
    },
  });

  if (!work) {
    throw new Error('Work not found or access denied');
  }

  // Safety check: Don't delete works with submissions
  if (work.submissions.length > 0) {
    throw new Error('Cannot delete work with submissions');
  }

  // Safety check: Only delete if all versions are drafts
  const allVersionsAreDraft = work.versions.every((v) => v.draft === true);
  if (!allVersionsAreDraft) {
    throw new Error('Cannot delete work with non-draft versions');
  }

  if (work.versions.length === 0) {
    throw new Error('No work versions found to delete');
  }

  // Store versions for file deletion after transaction
  const workVersions = work.versions;

  // Delete in the correct order to handle foreign key constraints
  await prisma.$transaction(async (tx) => {
    // Delete all work versions
    await tx.workVersion.deleteMany({
      where: { work_id: workId },
    });

    // Delete work users (foreign key constraint)
    await tx.workUser.deleteMany({
      where: { work_id: workId },
    });

    // Delete the work itself
    await tx.work.delete({
      where: { id: workId },
    });
  });

  // Delete files from CDN storage after successful database transaction
  await deleteWorkVersionFiles(ctx, workVersions);
}
