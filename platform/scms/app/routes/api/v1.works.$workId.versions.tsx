import type { Route } from './+types/v1.works.$workId.versions';
import {
  ensureJsonBodyFromMethod,
  CreateMystWorkPostBodySchema,
  validate,
  withAPISecureContext,
  checkWorkExists,
  works,
} from '@curvenote/scms-server';
import { error401, error404, error405, httpError } from '@curvenote/scms-core';

export async function loader() {
  throw error405();
}

export async function action(args: Route.ActionArgs) {
  // TODO: Update this to use withAPIWorkContext when we no longer
  //       need submission query parameter backdoor to load works
  const ctx = await withAPISecureContext(args);
  if (args.request.method === 'POST') {
    if (!ctx.user) throw error401();

    const { workId } = args.params;
    if (!workId) throw httpError(400, 'workId is required');

    // This just checks that the work exists at all; more permissions are checked on `create`
    const exists = await checkWorkExists(workId);
    if (!exists) throw httpError(404, 'work not found');

    const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
    const { cdn, cdn_key } = validate(CreateMystWorkPostBodySchema, body);
    const { url } = args.request;
    const query = new URL(url).search.slice(1);
    const searchParams = new URLSearchParams(query);
    const submission = searchParams.get('submission') ?? undefined;
    const dto = await works.versions.create(ctx, workId, { cdn, cdn_key }, submission);
    return Response.json(dto, { status: 201 });
  }
  throw error404();
}
