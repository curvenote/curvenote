import type { Context } from '../../context.server.js';
import { formatJobDTO } from './get.server.js';
import { error404 } from '@curvenote/scms-core';
import type { UpdateJob } from '@curvenote/scms-core';
import { dbUpdateJob } from './handlers/db.server.js';

export default async function (ctx: Context, jobId: string, data: UpdateJob) {
  const dbo = await dbUpdateJob(jobId, data);
  if (!dbo) throw error404();
  return formatJobDTO(ctx, dbo);
}
