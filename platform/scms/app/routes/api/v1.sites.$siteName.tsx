import type { Route } from './+types/v1.sites.$siteName';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISiteContext,
  withInsecureSiteContext,
  sites,
  works,
} from '@curvenote/scms-server';
import { error401, httpError, site } from '@curvenote/scms-core';
import { z } from 'zod';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withInsecureSiteContext(args);
  const contentVersion = await sites.dbGetSiteContent(ctx.site);
  const dto = sites.formatSiteWithContentDTO(ctx, ctx.site, contentVersion);
  return Response.json(dto);
}

const UpdateSitePatchBodySchema = z.object({
  // ID of work to use for site landing content
  content: z.uuid(),
});

/**
 * PATCH v1/sites/<name> to add work for landing content
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISiteContext(args, [site.update]);

  if (!ctx.user) throw error401();
  const body = await ensureJsonBodyFromMethod(args.request, ['PATCH']);
  const { content } = validate(UpdateSitePatchBodySchema, body);
  const work = await works.dbGetWorkForUser(ctx.user, content);
  if (!work) throw httpError(400, `content work ID not found: ${content}`);

  const dto = await sites.update(ctx, content);
  return Response.json(dto);
}
