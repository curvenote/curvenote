import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../prisma.server.js';
import type { Role } from '@prisma/client';

export interface CreateRoleData {
  name: string;
  title: string;
  description: string;
  scopes: string[];
  createdBy: string;
}

export interface UpdateRoleData {
  title: string;
  description: string;
  scopes: string[];
}

export interface RoleWithCreator extends Omit<Role, 'scopes'> {
  scopes: string[];
  creator: {
    id: string;
    username: string | null;
    display_name: string | null;
    email: string | null;
  };
}

/**
 * Process scopes to ensure we have a clean string array
 * Filters out undefined, null, and non-string values
 */
function processScopes(scopes: unknown): string[] {
  if (!scopes) return [];
  if (!Array.isArray(scopes)) return [];
  return scopes.filter((scope): scope is string => typeof scope === 'string');
}

/**
 * Get all roles with creator information
 */
export async function getRoles() {
  const prisma = await getPrismaClient();
  const roles = await prisma.role.findMany({
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });

  // Process scopes to ensure clean string arrays
  return roles.map((role) => ({
    ...role,
    scopes: processScopes(role.scopes),
  }));
}

/**
 * Get a single role by ID
 */
export async function getRoleById(id: string): Promise<RoleWithCreator | null> {
  const prisma = await getPrismaClient();

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
        },
      },
    },
  });

  if (!role) return null;

  // Process scopes to ensure clean string array
  return {
    ...role,
    scopes: processScopes(role.scopes),
  };
}

/**
 * Create a new role
 */
export async function createRole(data: CreateRoleData): Promise<RoleWithCreator> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        name: data.name,
        title: data.title,
        description: data.description,
        scopes: data.scopes as any, // Prisma JSON type
        createdBy: data.createdBy,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            display_name: true,
            email: true,
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
        activity_by_id: data.createdBy,
        activity_type: 'ROLE_CREATED',
        role_id: role.id,
      },
    });

    // Process scopes to ensure clean string array
    return {
      ...role,
      scopes: processScopes(role.scopes),
    };
  });
}

/**
 * Update an existing role
 */
export async function updateRole(
  id: string,
  data: UpdateRoleData,
  updatedBy: string,
): Promise<RoleWithCreator> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        scopes: data.scopes as any, // Prisma JSON type
        date_modified: now,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            display_name: true,
            email: true,
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
        activity_by_id: updatedBy,
        activity_type: 'ROLE_UPDATED',
        role_id: role.id,
      },
    });

    // Process scopes to ensure clean string array
    return {
      ...role,
      scopes: processScopes(role.scopes),
    };
  });
}

/**
 * Delete a role (with placeholder protection logic)
 */
export async function deleteRole(
  id: string,
  deletedBy: string,
): Promise<{ success: boolean; error?: string }> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  try {
    return prisma.$transaction(async (tx) => {
      // Placeholder: Check if role is in use
      // TODO: Implement actual user role assignment checking
      // const usersWithRole = await getUsersWithRole(id);
      // if (usersWithRole.length > 0) {
      //   return { success: false, error: 'Cannot delete role that is assigned to users' };
      // }

      // Log the activity BEFORE deleting the role (to preserve audit trail)
      await tx.activity.create({
        data: {
          id: uuidv7(),
          date_created: now,
          date_modified: now,
          activity_by_id: deletedBy,
          activity_type: 'ROLE_DELETED',
          role_id: id,
        },
      });

      await tx.role.delete({
        where: { id },
      });

      return { success: true };
    });
  } catch (error) {
    console.error('Failed to delete role:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete role',
    };
  }
}

/**
 * Check if a role name is unique
 */
export async function isRoleNameUnique(name: string, excludeId?: string): Promise<boolean> {
  const prisma = await getPrismaClient();

  const existingRole = await prisma.role.findFirst({
    where: {
      name,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });

  return !existingRole;
}
