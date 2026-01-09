// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { clientGetUserSiteNames } from './scopes.js';

// Mock for system.admin constant
describe('clientGetUserSiteNames', () => {
  it('should return site names where the user has at least read access', () => {
    const userScopes = [
      'site:read:agrogeo',
      'site:update:agrogeo',
      'site:read:agu',
      'site:update:agu',
    ];
    expect(clientGetUserSiteNames(userScopes)).toEqual(['agrogeo', 'agu']);
  });

  it('should handle an empty userScopes array', () => {
    const userScopes: string[] = [];
    expect(clientGetUserSiteNames(userScopes)).toBeNull();
  });

  it('should handle scopes without read access', () => {
    const userScopes = ['site:list:agrogeo', 'site:update:agu', 'site:submissions:create:agu'];
    expect(clientGetUserSiteNames(userScopes)).toEqual(['agrogeo', 'agu']);
  });

  it('should extract site names from mixed access levels', () => {
    const userScopes = [
      'site:read:agrogeo',
      'site:list:agrogeo',
      'site:read:agu',
      'site:submissions:update:agu',
    ];
    expect(clientGetUserSiteNames(userScopes)).toEqual(['agrogeo', 'agu']);
  });

  it('should not include duplicate site names', () => {
    const userScopes = [
      'site:read:agrogeo',
      'site:update:agrogeo',
      'site:read:agu',
      'site:read:agu',
    ];
    expect(clientGetUserSiteNames(userScopes)).toEqual(['agrogeo', 'agu']);
  });

  it('should handle scopes with unrelated prefixes', () => {
    const userScopes = [
      'unrelated:prefix:agrogeo',
      'site:read:agrogeo',
      'other:prefix:agu',
      'site:read:agu',
    ];
    expect(clientGetUserSiteNames(userScopes)).toEqual(['agrogeo', 'agu']);
  });
});
