import type { Route } from './+types/v1.previews.$submissionVersionId';
import { httpError } from '@curvenote/scms-core';
import { withContext, previews } from '@curvenote/scms-server';

export const loader = async (args: Route.LoaderArgs) => {
  const ctx = await withContext(args);
  const { submissionVersionId } = args.params;
  if (!submissionVersionId) throw httpError(400, 'Missing submissionVersionId');
  return previews.get(ctx, submissionVersionId);
};
