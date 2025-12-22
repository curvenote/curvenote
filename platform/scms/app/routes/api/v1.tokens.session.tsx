import type { Route } from './+types/v1.tokens.session';
import { error401 } from '@curvenote/scms-core';
import { withContext, tokens } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args, { noTokens: true }); // context will not try to validate incoming tokens
  const tokenHeader = args.request.headers.get('authorization'); // Only in the authorization header
  if (!tokenHeader) throw error401();
  tokens.validateSessionJWT(ctx, tokenHeader);
  return Response.json({ valid: true });
}
