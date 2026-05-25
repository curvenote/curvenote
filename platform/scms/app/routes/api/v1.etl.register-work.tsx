import type { Route } from './+types/v1.etl.register-work';
import { error405 } from '@curvenote/scms-core';
import { etlRegisterWorkFromRequest } from '@curvenote/scms-server';

export async function loader() {
  throw error405();
}

export async function action(args: Route.ActionArgs) {
  return etlRegisterWorkFromRequest(args.request);
}
