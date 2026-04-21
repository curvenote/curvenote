// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { SystemRole } from '@curvenote/scms-db';
import { getSystemRoleScopes, hasDefaultScopeViaSystemRole } from './roles.server.js';
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
