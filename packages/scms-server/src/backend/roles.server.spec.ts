// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { work } from '@curvenote/scms-core';
import { SystemRole, WorkRole } from '@curvenote/scms-db';
import {
  getSystemRoleScopes,
  hasDefaultScopeViaSystemRole,
  hasWorkScope,
  isSystemRole,
  SYSTEM_ROLES,
} from './roles.server.js';
import { userHasScope } from './scopes.helpers.server.js';

function createUser(role: SystemRole) {
  return {
    id: 'user-1',
    system_role: role,
    roles: [],
    site_roles: [],
    work_roles: [],
  } as any;
}

describe('isSystemRole / SYSTEM_ROLES', () => {
  test('accepts every Prisma SystemRole value', () => {
    for (const role of Object.values(SystemRole)) {
      expect(isSystemRole(role)).toBe(true);
    }
  });

  test('rejects arbitrary strings', () => {
    expect(isSystemRole('SUPERADMIN')).toBe(false);
    expect(isSystemRole('')).toBe(false);
  });

  test('SYSTEM_ROLES lists each enum member once', () => {
    expect(SYSTEM_ROLES.length).toBe(Object.values(SystemRole).length);
    expect(new Set(SYSTEM_ROLES).size).toBe(SYSTEM_ROLES.length);
  });
});

describe('work role scope mapping', () => {
  test('only OWNER may update work user assignments; CONTRIBUTORS may read', () => {
    expect(hasWorkScope(WorkRole.OWNER, work.id.users.update)).toBe(true);
    expect(hasWorkScope(WorkRole.CONTRIBUTOR, work.id.users.update)).toBe(false);
    expect(hasWorkScope(WorkRole.CONTRIBUTOR, work.id.users.read)).toBe(true);
  });
});

describe('default system role scope mapping', () => {
  test('uses default hardcoded mapping by default', () => {
    expect(hasDefaultScopeViaSystemRole(SystemRole.ADMIN, 'system:admin')).toBe(true);
    expect(hasDefaultScopeViaSystemRole(SystemRole.ADMIN, 'app:settings:read')).toBe(false);
  });

  test('returns default system scopes', () => {
    expect(getSystemRoleScopes(SystemRole.ADMIN)).toContain('system:admin');
    expect(hasDefaultScopeViaSystemRole(SystemRole.ADMIN, 'system:admin')).toBe(true);
  });

  test('userHasScope resolves against loaded user.system_scopes', () => {
    const user = createUser(SystemRole.ADMIN) as any;
    user.system_scopes = ['app:dashboard:read'];

    expect(userHasScope(user, 'app:dashboard:read')).toBe(true);
    expect(userHasScope(user, 'app:platform:admin')).toBe(false);
  });
});
