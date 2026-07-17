import type { Route } from './+types/v1.previews.$id';
import { httpError } from '@curvenote/scms-core';
import { withContext, previews } from '@curvenote/scms-server';

export const loader = async (args: Route.LoaderArgs) => {
  const ctx = await withContext(args);
  const { id } = args.params;
  if (!id) throw httpError(400, 'Missing id');
  return previews.get(ctx, id);
};
