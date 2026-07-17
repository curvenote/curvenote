// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { SystemRole } from '@curvenote/scms-db';
import { system } from '@curvenote/scms-core';
import { DEFAULT_SYSTEM_ROLE_SCOPES, MACHINE_SYSTEM_ROLES } from './systemRoleDefaults.js';

describe('DEFAULT_SYSTEM_ROLE_SCOPES', () => {
  test('SERVICE matches USER and does not grant system.admin', () => {
    expect(DEFAULT_SYSTEM_ROLE_SCOPES[SystemRole.SERVICE]).toEqual(
      DEFAULT_SYSTEM_ROLE_SCOPES[SystemRole.USER],
    );
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
