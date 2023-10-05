import vi, { describe, expect, test } from 'vitest';
import * as web from '../src/web/index.js';

describe('deploy.web', () => {
  describe('deployment strategy', () => {
    test('venue overrides domains', () => {
      const config = { domains: ['test2.curve.space', 'myblog.com'] };

      const strategy = web.resolveDeploymentStrategy(config, {
        domain: 'test.curve.space',
        venue: 'myjournal',
      });

      expect(strategy).toEqual('private-venue');
    });
    describe('domain enables public deployment', () => {
      test('domain on command line', () => {
        const config = {};

        const strategy = web.resolveDeploymentStrategy(config, {
          domain: 'test.curve.space',
        });

        expect(strategy).toEqual('public');
      });
      test('domains in configuration', () => {
        const config = { domains: ['test2.curve.space', 'myblog.com'] };

        const strategy = web.resolveDeploymentStrategy(config, {});

        expect(strategy).toEqual('public');
      });
    });
    test('default is private', () => {
      const config = {};
      const strategy = web.resolveDeploymentStrategy(config, {});
      expect(strategy).toEqual('default-private');
    });
  });
});
