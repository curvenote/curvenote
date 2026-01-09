// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';

// We need to access the private function for testing
// Since it's not exported, we'll need to test it through the public API
// or we can temporarily export it for testing purposes
import { loadAndValidateSigninSignupConfig } from './index.server.js';

describe('validateSigninSignupConfig', () => {
  // Helper function to test the validation by calling loadAndValidateSigninSignupConfig
  // which internally calls validateSigninSignupConfig
  const testValidation = (config: any, auth?: any) => {
    const deploymentConfig = {
      auth: auth ?? {
        google: {},
        github: {},
        firebase: {},
      },
      app: config,
      api: {},
      name: 'test',
    } as any; // Cast to any to avoid full Config type requirements
    return loadAndValidateSigninSignupConfig(deploymentConfig);
  };

  describe('handles undefined and null configurations gracefully', () => {
    it('should pass validation when signin config is undefined', () => {
      const config = {
        signin: undefined,
        signup: {
          mode: 'all',
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when signup config is undefined', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: undefined,
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when both signin and signup are undefined', () => {
      const config = {
        signin: undefined,
        signup: undefined,
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when config object is completely undefined', () => {
      expect(() => testValidation(undefined)).not.toThrow();
    });

    it('should pass validation when config object is null', () => {
      expect(() => testValidation(null)).not.toThrow();
    });
  });

  describe('handles undefined nested properties gracefully', () => {
    it('should pass validation when signin.mode is undefined', () => {
      const config = {
        signin: {
          mode: undefined,
          preferred: 'google',
        },
        signup: {
          mode: 'all',
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when signin.preferred is undefined', () => {
      const config = {
        signin: {
          mode: 'preferred',
          preferred: undefined,
        },
        signup: {
          mode: 'all',
          approval: { manual: true, skipApproval: [] },
        },
      };

      // This should throw because preferred is required when mode is 'preferred'
      expect(() => testValidation(config)).toThrow(
        'Configuration error - signin.preferred is required when signin.mode is "preferred"',
      );
    });

    it('should pass validation when signup.mode is undefined', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: undefined,
          preferred: 'google',
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when signup.preferred is undefined', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'preferred',
          preferred: undefined,
        },
      };

      // This should throw because preferred is required when mode is 'preferred'
      expect(() => testValidation(config)).toThrow(
        'Configuration error - signup.preferred is required when signup.mode is "preferred"',
      );
    });

    it('should pass validation when signup.approval is undefined', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          approval: undefined,
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when signup.steps is undefined', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: undefined,
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });
  });

  describe('validates preferred provider configurations', () => {
    it('should throw error when signin.preferred is required but missing', () => {
      const config = {
        signin: {
          mode: 'preferred',
          // preferred is missing
        },
        signup: {
          mode: 'all',
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).toThrow(
        'Configuration error - signin.preferred is required when signin.mode is "preferred"',
      );
    });

    it('should throw error when signin.preferred provider is not enabled', () => {
      const config = {
        signin: {
          mode: 'preferred',
          preferred: 'microsoft', // not in enabledProviders
        },
        signup: {
          mode: 'all',
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).toThrow(
        'Configuration error - signin.preferred provider "microsoft" is not enabled',
      );
    });

    it('should pass validation when signin.preferred provider is enabled', () => {
      const config = {
        signin: {
          mode: 'preferred',
          preferred: 'google',
        },
        signup: {
          mode: 'all',
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should throw error when signup.preferred is required but missing', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'preferred',
          // preferred is missing
        },
      };

      expect(() => testValidation(config)).toThrow(
        'Configuration error - signup.preferred is required when signup.mode is "preferred"',
      );
    });

    it('should throw error when signup.preferred provider is not enabled', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'preferred',
          preferred: 'microsoft', // not in enabledProviders
        },
      };

      expect(() => testValidation(config)).toThrow(
        'Configuration error - signup.preferred provider "microsoft" is not enabled',
      );
    });

    it('should pass validation when signup.preferred provider is enabled', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'preferred',
          preferred: 'github',
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });
  });

  describe('validates skip approval providers', () => {
    it('should pass validation when skipApproval is undefined', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          approval: {
            manual: true,
            // skipApproval is undefined
          },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when skipApproval is empty array', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          approval: {
            manual: true,
            skipApproval: [],
          },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should throw error when skipApproval contains unknown provider', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          approval: {
            manual: true,
            skipApproval: ['microsoft'], // not in enabledProviders
          },
        },
      };

      expect(() => testValidation(config)).toThrow(
        'Configuration error - signup.approval.skipApproval contains unknown provider "microsoft"',
      );
    });

    it('should pass validation when skipApproval contains only enabled providers', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          approval: {
            manual: true,
            skipApproval: ['google', 'github'],
          },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });
  });

  describe('validates signup step providers', () => {
    it('should pass validation when steps is undefined', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: undefined,
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when steps is empty array', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: [],
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should pass validation when steps contain no link-providers steps', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: [
            {
              type: 'data-collection',
              title: 'Data Collection',
            },
            {
              type: 'agreement',
              title: 'Agreement',
            },
          ],
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });

    it('should throw error when link-providers step contains unknown provider', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: [
            {
              type: 'link-providers',
              title: 'Link Providers',
              providers: ['microsoft'], // not in enabledProviders
            },
          ],
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).toThrow(
        'Configuration error - signup step "Link Providers" references unknown provider "microsoft"',
      );
    });

    it('should pass validation when link-providers step contains only enabled, linkable providers', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: [
            {
              type: 'link-providers',
              title: 'Link Providers',
              providers: ['google', 'github'],
            },
          ],
          approval: { manual: true, skipApproval: [] },
        },
      };

      const auth = {
        google: {
          allowLinking: true,
        },
        github: {
          allowLinking: true,
        },
      };

      expect(() => testValidation(config, auth)).not.toThrow();
    });

    it('should throw when link-providers step contains any enabled, but not linkable providers', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: [
            {
              type: 'link-providers',
              title: 'Link Providers',
              providers: ['google', 'github'],
            },
          ],
          approval: { manual: true, skipApproval: [] },
        },
      };

      const auth = {
        google: {
          allowLinking: true,
        },
        github: {
          allowLinking: false,
        },
      };

      expect(() => testValidation(config, auth)).toThrow();
    });

    it('should throw when link-providers step has undefined providers', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: [
            {
              type: 'link-providers',
              title: 'Link Providers',
              providers: undefined,
            },
          ],
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).toThrow();
    });

    it('should pass validation when link-providers step has empty providers array', () => {
      const config = {
        signin: {
          mode: 'all',
        },
        signup: {
          mode: 'all',
          steps: [
            {
              type: 'link-providers',
              title: 'Link Providers',
              providers: [],
            },
          ],
          approval: { manual: true, skipApproval: [] },
        },
      };

      expect(() => testValidation(config)).not.toThrow();
    });
  });

  describe('complex validation scenarios', () => {
    it('should pass validation with complete valid configuration', () => {
      const config = {
        signin: {
          mode: 'preferred',
          preferred: 'github',
          prompt: 'Sign in with GitHub',
        },
        signup: {
          mode: 'preferred',
          preferred: 'github',
          prompt: 'Sign up with GitHub',
          steps: [
            {
              type: 'link-providers',
              title: 'Link Additional Providers',
              providers: ['firebase'],
            },
            {
              type: 'data-collection',
              title: 'Data Collection',
            },
          ],
          approval: {
            manual: true,
            skipApproval: ['github'],
          },
        },
      };

      const auth = {
        github: {
          allowLinking: true,
        },
        firebase: {
          allowLinking: true,
        },
      };

      expect(() => testValidation(config, auth)).not.toThrow();
    });

    it('should handle mixed valid and invalid configurations', () => {
      const config = {
        signin: {
          mode: 'all', // valid
        },
        signup: {
          mode: 'preferred',
          preferred: 'microsoft', // invalid - not enabled
          steps: [
            {
              type: 'link-providers',
              title: 'Link Providers',
              providers: ['google'], // valid
            },
          ],
          approval: {
            manual: true,
            skipApproval: ['microsoft'], // invalid - not enabled
          },
        },
      };

      // Should throw for the first error encountered (signup.preferred)
      expect(() => testValidation(config)).toThrow(
        'Configuration error - signup.preferred provider "microsoft" is not enabled',
      );
    });
  });
});
