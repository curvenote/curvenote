// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  OBFUSCATED_SECRET_PLACEHOLDER,
  obfuscateSecret,
  sanitizeExtensionAdminConfig,
} from './sanitize-admin-config.js';

describe('obfuscateSecret', () => {
  it('returns the placeholder for non-empty secrets', () => {
    expect(obfuscateSecret('sk-live-abc')).toBe(OBFUSCATED_SECRET_PLACEHOLDER);
    expect(obfuscateSecret(0)).toBe(OBFUSCATED_SECRET_PLACEHOLDER);
    expect(obfuscateSecret(false)).toBe(OBFUSCATED_SECRET_PLACEHOLDER);
  });

  it('returns empty string for missing or empty secrets', () => {
    expect(obfuscateSecret('')).toBe('');
    expect(obfuscateSecret(null)).toBe('');
    expect(obfuscateSecret(undefined)).toBe('');
  });
});

describe('sanitizeExtensionAdminConfig', () => {
  it('obfuscates non-empty secret keys and leaves empty secrets empty', () => {
    expect(
      sanitizeExtensionAdminConfig({
        apiKey: 'secret-value',
        token: '',
        password: null,
        access_token: undefined,
      }),
    ).toEqual({
      apiKey: OBFUSCATED_SECRET_PLACEHOLDER,
      token: '',
      password: '',
      access_token: '',
    });
  });

  it('recurses into nested objects', () => {
    expect(
      sanitizeExtensionAdminConfig({
        ingest: {
          baseUrl: 'https://example.test',
          apiKey: 'nested-secret',
          apiKeyConfigured: true,
        },
      }),
    ).toEqual({
      ingest: {
        baseUrl: 'https://example.test',
        apiKey: OBFUSCATED_SECRET_PLACEHOLDER,
        apiKeyConfigured: true,
      },
    });
  });

  it('leaves non-secret keys untouched', () => {
    const input = {
      routes: true,
      baseUrl: 'https://example.test',
      originSource: 'config',
      nested: { label: 'ok', count: 2 },
    };
    expect(sanitizeExtensionAdminConfig(input)).toEqual(input);
  });

  it('matches secret key names case-insensitively', () => {
    expect(sanitizeExtensionAdminConfig({ APIKEY: 'x', Client_Secret: 'y' })).toEqual({
      APIKEY: OBFUSCATED_SECRET_PLACEHOLDER,
      Client_Secret: OBFUSCATED_SECRET_PLACEHOLDER,
    });
  });
});
