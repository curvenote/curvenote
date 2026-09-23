import type { JobRegistration, ServerExtension } from '@curvenote/scms-core';
import { KnownJobTypes } from '@curvenote/scms-core';
import { crossrefDepositHandler } from './backend/jobs/crossrefDeposit.server.js';
import { registerRoutes } from './routes.js';
import { extension as clientExtension } from './client.js';

/** First extension-owned job handler in the repo; CROSSREF_POLL joins in CN-2582. */
function getJobs(): JobRegistration[] {
  return [{ jobType: KnownJobTypes.CROSSREF_DEPOSIT, handler: crossrefDepositHandler }];
}

function getSafeAdminConfig(config: Record<string, unknown>): Record<string, unknown> {
  const featuredConfig =
    config.featured && typeof config.featured === 'object'
      ? (config.featured as Record<string, unknown>)
      : undefined;

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
    featured: featuredConfig
      ? {
          title: featuredConfig.title,
          description: featuredConfig.description,
          sites: Array.isArray(featuredConfig.sites)
            ? (featuredConfig.sites as Record<string, unknown>[]).map((site) => ({
                title: site.title,
                url: site.url,
                thumbnail: site.thumbnail,
              }))
            : undefined,
        }
      : undefined,
  };
}

export const extension: ServerExtension = {
  ...clientExtension,
  registerRoutes,
  getSafeAdminConfig,
  getJobs,
};
