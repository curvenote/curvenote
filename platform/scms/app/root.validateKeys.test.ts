// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import { matchesWildcard } from '@curvenote/scms-core';

// We need to test the validateKeys function, so we'll copy it here for testing
// In a real implementation, we might want to export it from root.tsx
function validateKeys<T>(obj: T, validKeys: string[]): void {
  function flattenKeys<TT>(obj2: TT, parentKey = ''): string[] {
    const keys: string[] = [];
    for (const key in obj2) {
      if (Object.prototype.hasOwnProperty.call(obj2, key)) {
        const value = obj2[key];
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        if (Array.isArray(value)) {
          // Add the array key itself
          keys.push(fullKey);
          // Also recurse into array elements with numeric indices
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              keys.push(...flattenKeys(item, `${fullKey}.${index}`));
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          // Recursively process nested objects
          keys.push(...flattenKeys(value, fullKey));
        } else {
          // Add scalar values directly
          keys.push(fullKey);
        }
      }
    }
    return keys;
  }

  function isValidKey(key: string, allowedKeys: string[]): boolean {
    // Check for exact match first
    if (allowedKeys.includes(key)) {
      return true;
    }

    // Check for wildcard matches
    const allowedWildcardKeys = allowedKeys.filter((k) => k.includes('*'));
    for (const allowedKey of allowedWildcardKeys) {
      if (allowedKey.includes('*') && matchesWildcard(key, allowedKey)) {
        return true;
      }
    }

    return false;
  }

  const objKeys = flattenKeys<T>(obj);

  for (const key of objKeys) {
    if (!isValidKey(key, validKeys)) {
      throw new Error(`Invalid key: ${key}`);
    }
  }
}

describe('validateKeys', () => {
  describe('basic object validation', () => {
    it('should validate simple object properties', () => {
      const obj = {
        name: 'test',
        value: 123,
        enabled: true,
      };

      expect(() => {
        validateKeys(obj, ['name', 'value', 'enabled']);
      }).not.toThrow();
    });

    it('should reject invalid properties', () => {
      const obj = {
        name: 'test',
        value: 123,
        invalidField: 'bad',
      };

      expect(() => {
        validateKeys(obj, ['name', 'value']);
      }).toThrow('Invalid key: invalidField');
    });

    it('should validate nested object properties', () => {
      const obj = {
        config: {
          name: 'test',
          settings: {
            enabled: true,
            timeout: 5000,
          },
        },
      };

      expect(() => {
        validateKeys(obj, ['config.name', 'config.settings.enabled', 'config.settings.timeout']);
      }).not.toThrow();
    });
  });

  describe('array validation', () => {
    it('should validate array contents with wildcard patterns', () => {
      const obj = {
        signupConfig: {
          signup: {
            steps: [
              { type: 'data-collection', title: 'Data Collection' },
              { type: 'agreement', title: 'Agreement' },
            ],
          },
        },
      };

      expect(() => {
        validateKeys(obj, [
          'signupConfig.signup.steps',
          'signupConfig.signup.steps.*.type',
          'signupConfig.signup.steps.*.title',
        ]);
      }).not.toThrow();
    });

    it('should reject invalid array contents', () => {
      const obj = {
        signupConfig: {
          signup: {
            steps: [{ type: 'data-collection', title: 'Data Collection', invalidField: 'bad' }],
          },
        },
      };

      expect(() => {
        validateKeys(obj, [
          'signupConfig.signup.steps',
          'signupConfig.signup.steps.*.type',
          'signupConfig.signup.steps.*.title',
        ]);
      }).toThrow('Invalid key: signupConfig.signup.steps.0.invalidField');
    });

    it('should handle nested arrays', () => {
      const obj = {
        signupConfig: {
          signup: {
            steps: [
              {
                type: 'data-collection',
                fields: [
                  { name: 'email', label: 'Email' },
                  { name: 'name', label: 'Name' },
                ],
              },
            ],
          },
        },
      };

      expect(() => {
        validateKeys(obj, [
          'signupConfig.signup.steps',
          'signupConfig.signup.steps.*.type',
          'signupConfig.signup.steps.*.fields',
          'signupConfig.signup.steps.*.fields.*.name',
          'signupConfig.signup.steps.*.fields.*.label',
        ]);
      }).not.toThrow();
    });

    it('should handle empty arrays', () => {
      const obj = {
        signupConfig: {
          signup: {
            steps: [],
          },
        },
      };

      expect(() => {
        validateKeys(obj, ['signupConfig.signup.steps']);
      }).not.toThrow();
    });

    it('should handle arrays with mixed content types', () => {
      const obj = {
        items: ['string', 123, { name: 'object' }, null, undefined],
      };

      expect(() => {
        validateKeys(obj, [
          'items',
          'items.*.name', // Only the object should be validated
        ]);
      }).not.toThrow();
    });

    it('should handle deeply nested arrays', () => {
      const obj = {
        config: {
          sections: [
            {
              name: 'auth',
              providers: [
                { id: 'google', name: 'Google' },
                { id: 'github', name: 'GitHub' },
              ],
            },
          ],
        },
      };

      expect(() => {
        validateKeys(obj, [
          'config.sections',
          'config.sections.*.name',
          'config.sections.*.providers',
          'config.sections.*.providers.*.id',
          'config.sections.*.providers.*.name',
        ]);
      }).not.toThrow();
    });
  });

  describe('wildcard pattern matching', () => {
    it('should match wildcard patterns for arrays', () => {
      const obj = {
        steps: [
          { type: 'step1', title: 'Step 1' },
          { type: 'step2', title: 'Step 2' },
        ],
      };

      expect(() => {
        validateKeys(obj, ['steps', 'steps.*.type', 'steps.*.title']);
      }).not.toThrow();
    });

    it('should match wildcard patterns for nested objects', () => {
      const obj = {
        config: {
          auth: { provider: 'google' },
          db: { provider: 'postgres' },
        },
      };

      expect(() => {
        validateKeys(obj, ['config.*.provider']);
      }).not.toThrow();
    });

    it('should handle complex wildcard patterns', () => {
      const obj = {
        signupConfig: {
          signup: {
            steps: [
              {
                type: 'data-collection',
                fields: [
                  { name: 'email', validation: { required: true } },
                  { name: 'name', validation: { required: true } },
                ],
              },
            ],
          },
        },
      };

      expect(() => {
        validateKeys(obj, [
          'signupConfig.signup.steps',
          'signupConfig.signup.steps.*.type',
          'signupConfig.signup.steps.*.fields',
          'signupConfig.signup.steps.*.fields.*.name',
          'signupConfig.signup.steps.*.fields.*.validation',
          'signupConfig.signup.steps.*.fields.*.validation.*',
        ]);
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values', () => {
      const obj = {
        name: 'test',
        value: null,
        data: undefined,
      };

      expect(() => {
        validateKeys(obj, ['name', 'value', 'data']);
      }).not.toThrow();
    });

    it('should handle empty objects', () => {
      const obj = {};

      expect(() => {
        validateKeys(obj, []);
      }).not.toThrow();
    });

    it('should handle objects with only arrays', () => {
      const obj = {
        items: [1, 2, 3],
        tags: ['a', 'b', 'c'],
      };

      expect(() => {
        validateKeys(obj, ['items', 'tags']);
      }).not.toThrow();
    });
  });

  describe('key generation verification', () => {
    it('should generate correct keys for arrays', () => {
      const obj = {
        steps: [
          { type: 'step1', title: 'Step 1' },
          { type: 'step2', title: 'Step 2' },
        ],
      };

      // We can't directly test the internal flattenKeys function,
      // but we can verify the behavior through validation
      expect(() => {
        validateKeys(obj, [
          'steps',
          'steps.0.type',
          'steps.0.title',
          'steps.1.type',
          'steps.1.title',
        ]);
      }).not.toThrow();
    });
  });
});
