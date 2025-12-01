import type { NodeRenderers } from '@myst-theme/providers';
import { AnyWidgetRenderer } from './renderers.js';

export * from './models.js';
export * from '../types.js';

export const ANY_RENDERERS: NodeRenderers = {
  block: {
    'block[kind=any:widget]': AnyWidgetRenderer,
    'block[kind=any:bundle]': AnyWidgetRenderer,
  },
};
