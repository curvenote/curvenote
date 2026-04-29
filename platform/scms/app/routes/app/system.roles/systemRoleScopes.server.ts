import type { SystemRole } from '@curvenote/scms-db';
import type { SystemRoleScopeConfig as SystemRoleScopeConfigBase } from '@curvenote/scms-server';
import {
  getPrismaClient,
  getDefaultSystemRoleScopes,
  isSystemRole,
  isValidScopeFormat,
  processScopes,
  SYSTEM_ROLES,
} from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';

export type SystemRoleScopeConfig = SystemRoleScopeConfigBase & {
  fallback_scopes: string[];
};

export async function getAllSystemRoleScopes(): Promise<SystemRoleScopeConfig[]> {
  const prisma = await getPrismaClient();
  const rows = await prisma.systemRoleScope.findMany({
    select: {
      role: true,
      scopes: true,
      date_created: true,
      date_modified: true,
    },
  });

  const rowByRole = new Map<SystemRole, (typeof rows)[number]>();
  for (const row of rows) {
    if (isSystemRole(row.role)) {
      rowByRole.set(row.role, row);
    }
  }

  return SYSTEM_ROLES.map((role) => {
    const row = rowByRole.get(role);
    return {
      role,
      scopes: row ? processScopes(row.scopes) : getDefaultSystemRoleScopes(role),
      fallback_scopes: getDefaultSystemRoleScopes(role),
      date_created: row?.date_created ?? null,
      date_modified: row?.date_modified ?? null,
    };
  });
}

export async function updateSystemRoleScopes(
  role: string,
  scopes: string[],
  updatedBy: string,
): Promise<SystemRoleScopeConfig> {
  if (!isSystemRole(role)) throw new Error(`Invalid system role: ${role}`);
  const systemRole: SystemRole = role;
  if (scopes.length === 0) throw new Error('At least one scope is required');

  const invalidScopes = scopes.filter((scope) => !isValidScopeFormat(scope));
  if (invalidScopes.length > 0) {
    throw new Error(
      `Invalid scope format: ${invalidScopes.join(', ')}. Scopes must be lowercase and colon-delimited.`,
    );
  }

  const now = new Date().toISOString();
  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.systemRoleScope.upsert({
      where: { role: systemRole },
      create: {
        role: systemRole,
        date_created: now,
        date_modified: now,
        scopes,
      },
      update: {
        date_modified: now,
        scopes,
      },
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        activity_by_id: updatedBy,
        activity_type: 'ROLE_UPDATED',
        data: {
          role: systemRole,
          scopes,
          system_role: true,
        },
      },
    });
  });

  const allRoles = await getAllSystemRoleScopes();
  const updated = allRoles.find((row) => row.role === systemRole);
  if (!updated) {
    throw new Error(`Failed to recover updated row for system role: ${role}`);
  }
  return updated;
}

export async function deleteSystemRoleScopes(
  role: string,
  deletedBy: string,
): Promise<SystemRoleScopeConfig> {
  if (!isSystemRole(role)) throw new Error(`Invalid system role: ${role}`);
  const systemRole: SystemRole = role;

  const now = new Date().toISOString();
  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.systemRoleScope.deleteMany({
      where: { role: systemRole },
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        activity_by_id: deletedBy,
        activity_type: 'ROLE_UPDATED',
        data: {
          role: systemRole,
          system_role: true,
          deleted: true,
        },
      },
    });
  });

  return {
    role: systemRole,
    scopes: getDefaultSystemRoleScopes(systemRole),
    fallback_scopes: getDefaultSystemRoleScopes(systemRole),
    date_created: null,
    date_modified: null,
  };
}
