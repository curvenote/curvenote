import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../prisma.server.js';
import type { Prisma } from '@prisma/client';

export interface AssignRoleData {
  userId: string;
  roleId: string;
  assignedBy: string;
}

// Generate the type from the Prisma query using Prisma utility types
type UserRoleWithDetails = Prisma.UserRoleGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        display_name: true;
        email: true;
      };
    };
    role: {
      select: {
        id: true;
        name: true;
        title: true;
        description: true;
        scopes: true;
      };
    };
  };
}>;

/**
 * Get all user role assignments
 */
export async function getUserRoles() {
  const prisma = await getPrismaClient();

  return prisma.userRole.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
          title: true,
          description: true,
          scopes: true,
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });
}

/**
 * Get roles assigned to a specific user
 */
export async function getUserRolesByUserId(userId: string): Promise<UserRoleWithDetails[]> {
  const prisma = await getPrismaClient();

  return prisma.userRole.findMany({
    where: { user_id: userId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
          title: true,
          description: true,
          scopes: true,
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });
}

/**
 * Get users assigned to a specific role
 */
export async function getUsersByRoleId(roleId: string): Promise<UserRoleWithDetails[]> {
  const prisma = await getPrismaClient();

  return prisma.userRole.findMany({
    where: { role_id: roleId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
          title: true,
          description: true,
          scopes: true,
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });
}

/**
 * Assign a role to a user
 */
export async function assignRoleToUser(data: AssignRoleData): Promise<UserRoleWithDetails> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const userRole = await tx.userRole.create({
      data: {
        id: uuidv7(),
        user_id: data.userId,
        role_id: data.roleId,
        date_created: now,
        date_modified: now,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            display_name: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            title: true,
            description: true,
            scopes: true,
          },
        },
      },
    });

    // Log the activity within the transaction
    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        activity_by_id: data.assignedBy,
        activity_type: 'ROLE_ASSIGNED',
        user_role_id: userRole.id,
        user_id: data.userId,
        role_id: data.roleId,
      },
    });

    return userRole;
  });
}

/**
 * Remove a role from a user
 */
export async function removeRoleFromUser(
  userRoleId: string,
  removedBy: string,
): Promise<{ success: boolean; error?: string }> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  try {
    return prisma.$transaction(async (tx) => {
      // Get the user role details before deleting for activity logging
      const userRole = await tx.userRole.findUnique({
        where: { id: userRoleId },
        select: {
          user_id: true,
          role_id: true,
        },
      });

      if (!userRole) {
        return { success: false, error: 'User role assignment not found' };
      }

      // Log the activity BEFORE deleting the user role
      await tx.activity.create({
        data: {
          id: uuidv7(),
          date_created: now,
          date_modified: now,
          activity_by_id: removedBy,
          activity_type: 'ROLE_REMOVED',
          user_role_id: userRoleId,
          user_id: userRole.user_id,
          role_id: userRole.role_id,
        },
      });

      // Delete the user role after logging the activity
      await tx.userRole.delete({
        where: { id: userRoleId },
      });

      return { success: true };
    });
  } catch (error) {
    console.error('Failed to remove role from user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove role from user',
    };
  }
}

/**
 * Check if a user already has a specific role
 */
export async function userHasRole(userId: string, roleId: string): Promise<boolean> {
  const prisma = await getPrismaClient();

  const existingAssignment = await prisma.userRole.findFirst({
    where: {
      user_id: userId,
      role_id: roleId,
    },
  });

  return !!existingAssignment;
}

/**
 * Get all scopes for a user (from all their assigned roles)
 */
export async function getUserScopes(userId: string): Promise<string[]> {
  const prisma = await getPrismaClient();

  const userRoles = await prisma.userRole.findMany({
    where: { user_id: userId },
    include: {
      role: {
        select: {
          scopes: true,
        },
      },
    },
  });

  // Flatten all scopes from all roles
  const allScopes = userRoles.flatMap((userRole) => {
    const scopes = userRole.role.scopes;
    return Array.isArray(scopes) ? scopes.filter((scope) => typeof scope === 'string') : [];
  });

  // Remove duplicates
  return [...new Set(allScopes)];
}
