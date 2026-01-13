import type { Route } from './+types/v1';
import { error405, version } from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  await withContext(args);
  return Response.json({
    version,
    message: '👋 Welcome to the Curvenote Journal API 👋',
  });
}

export async function action() {
  throw error405();
}
