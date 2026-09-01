// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { site, system, work } from '@curvenote/scms-core';
import { SiteRole, SystemRole, WorkRole } from '@curvenote/scms-db';
import {
  DEFAULT_SYSTEM_ROLE_SCOPES,
  getSystemRoleScopes,
  hasDefaultScopeViaSystemRole,
  hasSiteScope,
  hasWorkScope,
  isSystemRole,
  MACHINE_SYSTEM_ROLES,
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
    expect(hasWorkScope(WorkRole.VIEWER, work.id.users.read)).toBe(true);
    expect(hasWorkScope(WorkRole.VIEWER, work.id.users.update)).toBe(false);
  });

  test('OWNER & CONTRIBUTOR may dispatch checks; all roles may read', () => {
    expect(hasWorkScope(WorkRole.OWNER, work.id.checks.dispatch)).toBe(true);
    expect(hasWorkScope(WorkRole.CONTRIBUTOR, work.id.checks.dispatch)).toBe(true);
    expect(hasWorkScope(WorkRole.VIEWER, work.id.checks.dispatch)).toBe(false);
    expect(hasWorkScope(WorkRole.VIEWER, work.id.checks.read)).toBe(true);
    expect(hasWorkScope(WorkRole.CONTRIBUTOR, work.id.checks.read)).toBe(true);
  });
});

describe('DEFAULT_SYSTEM_ROLE_SCOPES', () => {
  test('SERVICE grants work.list and work.create only, not system.admin', () => {
    expect(DEFAULT_SYSTEM_ROLE_SCOPES[SystemRole.SERVICE]).toEqual([work.list, work.create]);
    expect(DEFAULT_SYSTEM_ROLE_SCOPES[SystemRole.SERVICE]).not.toContain(system.admin);
  });

  test('SYSTEM_SERVICE grants system.admin only', () => {
    expect(DEFAULT_SYSTEM_ROLE_SCOPES[SystemRole.SYSTEM_SERVICE]).toEqual([system.admin]);
  });

  test('ADMIN retains system.admin', () => {
    expect(DEFAULT_SYSTEM_ROLE_SCOPES[SystemRole.ADMIN]).toEqual([system.admin]);
  });
});

describe('MACHINE_SYSTEM_ROLES', () => {
  test('includes site and platform machine roles', () => {
    expect(MACHINE_SYSTEM_ROLES).toEqual([SystemRole.SERVICE, SystemRole.SYSTEM_SERVICE]);
  });
});

describe('default system role scope mapping', () => {
  test('uses default hardcoded mapping by default', () => {
    expect(hasDefaultScopeViaSystemRole(SystemRole.ADMIN, 'system:admin')).toBe(true);
    expect(hasDefaultScopeViaSystemRole(SystemRole.SYSTEM_SERVICE, 'system:admin')).toBe(true);
    expect(hasDefaultScopeViaSystemRole(SystemRole.SERVICE, 'system:admin')).toBe(false);
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

describe('site tags scopes', () => {
  const tagScopes = [
    site.tags.list,
    site.tags.read,
    site.tags.create,
    site.tags.update,
    site.tags.delete,
  ];

  test('ADMIN has the full site:tags.* family', () => {
    for (const scope of tagScopes) {
      expect(hasSiteScope(SiteRole.ADMIN, scope)).toBe(true);
    }
  });

  test.each([SiteRole.MEMBER, SiteRole.SUBMITTER, SiteRole.PUBLIC, SiteRole.UNRESTRICTED])(
    '%s has no site:tags.* scopes',
    (role) => {
      for (const scope of tagScopes) {
        expect(hasSiteScope(role, scope)).toBe(false);
      }
    },
  );

  test('MEMBER still has kinds.list and still lacks tags.list', () => {
    expect(hasSiteScope(SiteRole.MEMBER, site.kinds.list)).toBe(true);
    expect(hasSiteScope(SiteRole.MEMBER, site.tags.list)).toBe(false);
  });
});
