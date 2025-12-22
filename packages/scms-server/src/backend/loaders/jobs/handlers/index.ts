import { checkCLIHandler, checkHandler } from './check.server.js';
import { publishHandler } from './publish.server.js';
import { unpublishHandler } from './unpublish.server.js';
import type { Context } from '../../../context.server.js';
import type { CreateJob, JobRegistration, ServerExtension } from '@curvenote/scms-core';
import type { StorageBackend } from '../../../storage/index.js';
import { KnownJobTypes } from '@curvenote/scms-core';
import { registerExtensionJobs } from '../../../../modules/extensions/jobs.js';

export type JobHandler = (
  ctx: Context,
  data: CreateJob,
  storageBackend?: StorageBackend,
) => Promise<any>;

export const coreHandlers: Record<string, JobHandler> = {
  [KnownJobTypes.CHECK]: checkHandler,
  [KnownJobTypes.CLI_CHECK]: checkCLIHandler,
  [KnownJobTypes.PUBLISH]: publishHandler,
  [KnownJobTypes.UNPUBLISH]: unpublishHandler,
};

export function getHandlers(extensionJobs: JobRegistration[]): Record<string, JobHandler> {
  const handlers = { ...coreHandlers };
  for (const job of extensionJobs) {
    handlers[job.jobType] = job.handler;
  }
  return handlers;
}

export * from './db.server.js';
