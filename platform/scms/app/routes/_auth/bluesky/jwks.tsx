import type { LoaderFunctionArgs } from 'react-router';
import { withContext, bluesky } from '@curvenote/scms-server';

export async function loader(args: LoaderFunctionArgs) {
  await withContext(args);
  const jwks = bluesky.getBlueskyJwks();
  if (!jwks) {
    return new Response(JSON.stringify({ error: 'JWKS not available' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(jwks), {
    headers: { 'Content-Type': 'application/json' },
  });
}
