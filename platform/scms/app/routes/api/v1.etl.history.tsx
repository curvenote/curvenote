import type { Route } from './+types/v1.etl.history';
import { error405 } from '@curvenote/scms-core';
import { etlHistoryFromRequest } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  return etlHistoryFromRequest(args.request);
}

export async function action() {
  throw error405();
}
