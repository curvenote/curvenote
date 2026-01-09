import type { ServerExtension } from '@curvenote/scms-core';
import { registerRoutes } from './routes.js';
import { extension as clientExtension } from './client.js';

export const extension: ServerExtension = {
  ...clientExtension,
  registerRoutes,
};
