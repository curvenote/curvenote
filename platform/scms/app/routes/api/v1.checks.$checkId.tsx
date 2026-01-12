import type { Route } from './+types/v1.checks.$checkId';
import { checks } from '@curvenote/check-definitions';
import { error404 } from '@curvenote/scms-core';
import { withContext, formatCheckDTO } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const check = checks.find((c) => c.id === args.params.checkId);
  if (!check) throw error404();
  const dto = formatCheckDTO(ctx, check);
  return Response.json(dto);
}
