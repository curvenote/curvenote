import type { Route } from './+types/v1.checks';
import { checks } from '@curvenote/check-definitions';
import { formatChecksDTO, withContext } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const dto = formatChecksDTO(ctx, checks);
  return Response.json(dto);
}
