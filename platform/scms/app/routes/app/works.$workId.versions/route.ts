import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { withAppWorkContext } from '@curvenote/scms-server';
import { getWorkflows, registerExtensionWorkflows, scopes } from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client.js';
import { dbLoadWorkVersionsTimeline } from './db.server.js';

/**
 * Resource route powering the works-listing work-version timeline hover card.
 *
 * JSON-only, no default export. Contract:
 *   GET /app/works/:workId/versions
 *     200 -> { versions: WorkVersionTimelineEntry[] }   (newest first)
 */
export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withAppWorkContext(args, [scopes.work.id.read], { redirect: false });

  const workflows = getWorkflows(ctx.$config, registerExtensionWorkflows(extensions));
  const versions = await dbLoadWorkVersionsTimeline(ctx.work.id, workflows);
  return data({ versions });
}
