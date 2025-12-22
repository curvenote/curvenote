import type { Route } from './+types/v1.$';
import { error404 } from '@curvenote/scms-core';

export async function loader(args: Route.LoaderArgs) {
  throw error404(`[v1.*] Not found GET ${args.request.url}`);
}

export async function action(args: Route.ActionArgs) {
  throw error404(`[v1.*] Not found ${args.request.method.toUpperCase()} ${args.request.url}`);
}
