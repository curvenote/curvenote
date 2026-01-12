import type { Route } from './+types/v1.login';
import { error401, httpError } from '@curvenote/scms-core';
import { withContext, tokens } from '@curvenote/scms-server';

export async function action(args: Route.ActionArgs) {
  const ctx = await withContext(args, { noTokens: true }); // context will not try to validate incoming tokens
  if (args.request.method !== 'POST') throw httpError(405, 'Method Not Allowed');
  const tokenHeader = args.request.headers.get('authorization'); // Only in the authorization header
  if (!tokenHeader) return error401();
  const token = await tokens.login(ctx, tokenHeader);
  return Response.json({ session: token });
}
