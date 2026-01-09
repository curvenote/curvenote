import type { Route } from './+types/v1.my.submissions.$submissionId';
import { httpError } from '@curvenote/scms-core';
import { withAPISecureContext, my } from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const { submissionId } = args.params;
  if (!submissionId) throw httpError(400, 'Missing submission ID');
  const dto = await my.submissions.get(ctx, extensions, submissionId);
  return Response.json(dto);
}
