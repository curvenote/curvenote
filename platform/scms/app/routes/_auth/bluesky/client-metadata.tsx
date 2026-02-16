import type { LoaderFunctionArgs } from 'react-router';
import { withContext, bluesky } from '@curvenote/scms-server';

export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withContext(args);
  const config = ctx.$config.auth?.bluesky;
  if (!config?.clientId || !config?.redirectUrl) {
    return new Response(JSON.stringify({ error: 'Bluesky auth not configured' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const metadata = bluesky.getBlueskyClientMetadata(config);
  return new Response(JSON.stringify(metadata), {
    headers: { 'Content-Type': 'application/json' },
  });
}
