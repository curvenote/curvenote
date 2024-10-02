import { describe, expect, test } from 'vitest';
import { getSignedCDNQuery } from './sign.js';

describe('sig', () => {
  test('expected params and signature should be present', () => {
    const query = getSignedCDNQuery({
      urlPrefix: 'abc',
      expires: 123,
      keyName: 'def',
      keyBase64: 'ghi',
    });

    expect(query).toContain(`URLPrefix=${Buffer.from('abc').toString('base64url')}`);
    expect(query).toContain('Expires=123');
    expect(query).toContain('KeyName=def');
    expect(query).toContain('Signature=');
    expect(query).toEqual(expect.stringMatching(/Signature=[a-zA-Z0-9_-]+/));
  });
});
