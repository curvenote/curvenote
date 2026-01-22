import { randomUUID } from 'crypto';
import { getPrismaClient } from '../prisma.server.js';
import type { MagicLink, MagicLinkAccess } from '@curvenote/scms-db';

export interface MagicLinkData {
  submissionId: string;
  siteName: string;
  name?: string;
  [key: string]: any;
}

export interface CreateMagicLinkParams {
  type: string; // e.g., "submission_preview"
  data: MagicLinkData;
  createdById: string;
  expiryDuration?: number; // in milliseconds
}

export interface LogAccessParams {
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Creates a new magic link
 */
export async function createMagicLink(params: CreateMagicLinkParams): Promise<MagicLink> {
  const { type, data, createdById, expiryDuration } = params;
  const prisma = await getPrismaClient();
  const now = new Date();
  const nowStr = now.toISOString();

  const expiry = expiryDuration ? new Date(now.getTime() + expiryDuration).toISOString() : null;

  const magicLink = await prisma.magicLink.create({
    data: {
      id: randomUUID(),
      date_created: nowStr,
      date_modified: nowStr,
      created_by_id: createdById,
      type,
      data: data as any,
      expiry,
      revoked: false,
      access_limit: null,
    },
  });

  return magicLink;
}

/**
 * Retrieves a magic link by ID
 */
export async function getMagicLink(linkId: string): Promise<MagicLink | null> {
  const prisma = await getPrismaClient();
  return prisma.magicLink.findUnique({
    where: { id: linkId },
  });
}

/**
 * Validates a magic link and returns validation result
 */
export async function validateMagicLink(link: MagicLink): Promise<{
  valid: boolean;
  reason?: string;
}> {
  // Check if revoked
  if (link.revoked) {
    return { valid: false, reason: 'Link has been revoked' };
  }

  // Check if expired
  if (link.expiry) {
    const expiryDate = new Date(link.expiry);
    if (expiryDate < new Date()) {
      return { valid: false, reason: 'Link has expired' };
    }
  }

  return { valid: true };
}

/**
 * Atomically validates a magic link and logs access if valid.
 * Uses a database transaction with row-level locking to prevent race conditions.
 *
 * @param linkId - The magic link ID
 * @param params - Access logging parameters
 * @returns Validation result and access log (if created)
 */
export async function validateAndLogAccess(
  linkId: string,
  params: LogAccessParams,
): Promise<{
  valid: boolean;
  reason?: string;
  accessLog?: MagicLinkAccess;
}> {
  const { ipAddress, userAgent, errorMessage } = params;
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    // Lock the magic link row to prevent concurrent access
    // This ensures only one transaction can check and update at a time
    // Using SELECT FOR UPDATE to acquire a row-level lock
    const linkResult = await tx.$queryRaw<MagicLink[]>`
      SELECT * FROM "MagicLink" WHERE id = ${linkId} FOR UPDATE
    `;

    if (!linkResult || linkResult.length === 0) {
      return { valid: false, reason: 'Link not found' };
    }

    const magicLink = linkResult[0];

    // Check if revoked
    if (magicLink.revoked) {
      // Log failed access
      const accessLog = await tx.magicLinkAccess.create({
        data: {
          id: randomUUID(),
          date_created: now,
          magic_link_id: linkId,
          ip_address: ipAddress ?? null,
          user_agent: userAgent ?? null,
          success: false,
          error_message: 'Link has been revoked',
        },
      });
      return { valid: false, reason: 'Link has been revoked', accessLog };
    }

    // Check if expired
    if (magicLink.expiry) {
      const expiryDate = new Date(magicLink.expiry);
      if (expiryDate < new Date()) {
        // Log failed access
        const accessLog = await tx.magicLinkAccess.create({
          data: {
            id: randomUUID(),
            date_created: now,
            magic_link_id: linkId,
            ip_address: ipAddress ?? null,
            user_agent: userAgent ?? null,
            success: false,
            error_message: 'Link has expired',
          },
        });
        return { valid: false, reason: 'Link has expired', accessLog };
      }
    }

    // All checks passed - log successful access
    const accessLog = await tx.magicLinkAccess.create({
      data: {
        id: randomUUID(),
        date_created: now,
        magic_link_id: linkId,
        ip_address: ipAddress ?? null,
        user_agent: userAgent ?? null,
        success: true,
        error_message: errorMessage ?? null,
      },
    });

    return { valid: true, accessLog };
  });
}

/**
 * Revokes a magic link
 */
export async function revokeMagicLink(linkId: string): Promise<MagicLink> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  return prisma.magicLink.update({
    where: { id: linkId },
    data: {
      revoked: true,
      date_modified: now,
    },
  });
}

/**
 * Reactivates a revoked magic link
 */
export async function reactivateMagicLink(linkId: string): Promise<MagicLink> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  return prisma.magicLink.update({
    where: { id: linkId },
    data: {
      revoked: false,
      date_modified: now,
    },
  });
}

/**
 * Permanently deletes a magic link.
 * Note: Access logs are preserved for audit purposes even after the magic link is deleted.
 */
export async function deleteMagicLink(linkId: string): Promise<void> {
  const prisma = await getPrismaClient();

  // Delete the magic link
  // Access logs are preserved for audit history (FK constraint removed to allow this)
  await prisma.magicLink.delete({
    where: { id: linkId },
  });
}

/**
 * Logs an access attempt to a magic link
 */
export async function logAccess(linkId: string, params: LogAccessParams): Promise<MagicLinkAccess> {
  const { ipAddress, userAgent, success, errorMessage } = params;
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  return prisma.magicLinkAccess.create({
    data: {
      id: randomUUID(),
      date_created: now,
      magic_link_id: linkId,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
      success,
      error_message: errorMessage ?? null,
    },
  });
}

/**
 * Gets all magic links for a specific submission
 */
export async function getMagicLinksForSubmission(
  submissionId: string,
): Promise<(MagicLink & { access_count: number })[]> {
  const prisma = await getPrismaClient();

  const links = await prisma.magicLink.findMany({
    where: {
      data: {
        path: ['submissionId'],
        equals: submissionId,
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });

  // Get access counts for each link
  const linksWithCounts = await Promise.all(
    links.map(async (link) => {
      const access_count = await prisma.magicLinkAccess.count({
        where: {
          magic_link_id: link.id,
          success: true,
        },
      });
      return { ...link, access_count };
    }),
  );

  return linksWithCounts;
}

/**
 * Gets access log for a magic link
 */
export async function getMagicLinkAccesses(
  linkId: string,
  limit: number = 50,
): Promise<MagicLinkAccess[]> {
  const prisma = await getPrismaClient();

  return prisma.magicLinkAccess.findMany({
    where: {
      magic_link_id: linkId,
    },
    orderBy: {
      date_created: 'desc',
    },
    take: limit,
  });
}
