import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from './prisma.server.js';
import type { User as UserPrisma, Access } from '@prisma/client';
import { getUserScopesSet } from './scopes.helpers.server.js';
import { ActivityType } from '@prisma/client';

export interface AccessGrants {
  scopes: string[];
  roles?: string[];
}

export interface CreateAccessParams {
  type: string;
  grants: AccessGrants;
  ownerId: string;
  receiverId?: string;
  workId?: string;
  siteId?: string;
}

/**
 * Create a new access record granting permissions to a user with activity logging
 */
export async function createAccess(params: CreateAccessParams): Promise<Access> {
  const now = new Date().toISOString();
  const prisma = await getPrismaClient();

  return prisma.$transaction(async (tx) => {
    // Create the access record
    const access = await tx.access.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        type: params.type,
        grants: params.grants as any,
        owner_id: params.ownerId,
        receiver_id: params.receiverId,
        work_id: params.workId,
        site_id: params.siteId,
        active: true,
      },
    });

    // Log the activity
    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        activity_by_id: params.ownerId,
        activity_type: ActivityType.ACCESS_GRANTED,
        access_id: access.id,
        user_id: params.receiverId,
      },
    });

    return access;
  });
}

/**
 * Get all access records granted by a specific user
 */
export async function getAccessGrantedBy(ownerId: string, type?: string): Promise<Access[]> {
  const prisma = await getPrismaClient();
  return prisma.access.findMany({
    where: {
      owner_id: ownerId,
      active: true,
      ...(type ? { type } : {}),
    },
    include: {
      receiver: {
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get all access records received by a specific user
 */
export async function getAccessReceivedBy(receiverId: string, type?: string): Promise<Access[]> {
  const prisma = await getPrismaClient();
  return prisma.access.findMany({
    where: {
      receiver_id: receiverId,
      active: true,
      ...(type ? { type } : {}),
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Check if a user has access to a specific resource through access grants
 */
export async function userHasAccess(
  user: UserPrisma & { access_received?: Access[] },
  scope: string,
  resourceId?: string,
  resourceType?: 'user' | 'work' | 'site',
): Promise<boolean> {
  // First check the user's direct scopes
  const userScopes = getUserScopesSet(user as any);
  if (userScopes.has(scope)) {
    return true;
  }

  // Then check access grants
  const accessGrants = user.access_received || (await getAccessReceivedBy(user.id));

  return accessGrants.some((access: Access) => {
    if (!access.active) return false;

    // Check if this access grant covers the resource
    if (resourceType && resourceId) {
      const resourceField = `${resourceType}_id` as keyof Access;
      if (access[resourceField] !== resourceId) {
        return false;
      }
    }

    // Check if the scope is granted
    const grants = access.grants as unknown as AccessGrants;
    return grants.scopes?.includes(scope) || false;
  });
}

/**
 * Revoke access by setting it inactive with activity logging
 * @param accessId - The access record ID to revoke
 * @param performedByUserId - Optional user ID who performed the revocation (for admin actions). If not provided, uses the owner_id.
 */
export async function revokeAccess(accessId: string, performedByUserId?: string): Promise<Access> {
  const now = new Date().toISOString();
  const prisma = await getPrismaClient();

  return prisma.$transaction(async (tx) => {
    // Get the access record to find who granted it
    const access = await tx.access.findUnique({
      where: { id: accessId },
      select: { owner_id: true, receiver_id: true },
    });

    if (!access) {
      throw new Error('Access record not found');
    }

    // Update the access record
    const updatedAccess = await tx.access.update({
      where: { id: accessId },
      data: {
        active: false,
        date_modified: now,
      },
    });

    // Log the activity - use performedByUserId if provided (for admin actions), otherwise use owner_id
    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        activity_by_id: performedByUserId || access.owner_id, // The person who performed the revocation
        activity_type: ActivityType.ACCESS_REVOKED,
        access_id: accessId,
        user_id: access.receiver_id, // The user who had access revoked
      },
    });

    return updatedAccess;
  });
}
