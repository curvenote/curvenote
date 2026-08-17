/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, it } from 'vitest';
import { combinePlugins } from './utils.js';

describe('combinePlugins', () => {
  it('returns a fully validated empty plugin', () => {
    expect(combinePlugins([])).toEqual({
      directives: [],
      roles: [],
      transforms: [],
      checks: [],
      renderers: [],
    });
  });

  it('combines renderers along with existing plugin fields', () => {
    const firstRenderer = { name: 'Panel', source: './panel.tsx' };
    const secondRenderer = { name: 'Figure', source: './figure.tsx' };

    const combined = combinePlugins([
      { renderers: [firstRenderer] },
      { renderers: [secondRenderer] },
    ]);

    expect(combined.renderers).toEqual([firstRenderer, secondRenderer]);
  });
});
