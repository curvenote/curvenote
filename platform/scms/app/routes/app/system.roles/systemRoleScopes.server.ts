import type { SystemRole } from '@curvenote/scms-db';
import { getPrismaClient, getDefaultSystemRoleScopes, isValidScopeFormat } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';

export interface SystemRoleScopeConfig {
  role: SystemRole;
  scopes: string[];
  fallback_scopes: string[];
  date_created: string | null;
  date_modified: string | null;
}

function isSystemRole(value: string): value is SystemRole {
  return ['SERVICE', 'ADMIN', 'USER', 'ANON'].includes(value);
}

function processScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return [];
  return scopes.filter((scope): scope is string => typeof scope === 'string');
}

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

  const roles: SystemRole[] = ['SERVICE', 'ADMIN', 'USER', 'ANON'];
  return roles.map((role) => {
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
      where: { role },
      create: {
        role,
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
          role,
          scopes,
          system_role: true,
        },
      },
    });
  });

  const allRoles = await getAllSystemRoleScopes();
  const updated = allRoles.find((row) => row.role === role);
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

  const now = new Date().toISOString();
  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.systemRoleScope.deleteMany({
      where: { role },
    });

    await tx.activity.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        activity_by_id: deletedBy,
        activity_type: 'ROLE_UPDATED',
        data: {
          role,
          system_role: true,
          deleted: true,
        },
      },
    });
  });

  return {
    role,
    scopes: getDefaultSystemRoleScopes(role),
    fallback_scopes: getDefaultSystemRoleScopes(role),
    date_created: null,
    date_modified: null,
  };
}
