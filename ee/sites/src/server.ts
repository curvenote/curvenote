import type { ServerExtension } from '@curvenote/scms-core';
import { registerRoutes } from './routes.js';
import { extension as clientExtension } from './client.js';

function getSafeAdminConfig(config: Record<string, unknown>): Record<string, unknown> {
  return {
    task: config.task,
    routes: config.routes,
    dataModels: config.dataModels,
    workflows: config.workflows,
    navigation: config.navigation,
    video:
      config.video && typeof config.video === 'object'
        ? {
            title: (config.video as Record<string, unknown>).title,
            url: (config.video as Record<string, unknown>).url,
            thumbnail: (config.video as Record<string, unknown>).thumbnail,
          }
        : undefined,
  };
}

export const extension: ServerExtension = {
  ...clientExtension,
  registerRoutes,
  getSafeAdminConfig,
};
