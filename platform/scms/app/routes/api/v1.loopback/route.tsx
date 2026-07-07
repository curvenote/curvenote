import { cronEndpointScope, version } from '@curvenote/scms-core';
import { getConfig, verifyEndpointScopedHandshake } from '@curvenote/scms-server';
import type { Route } from './+types/route';

const LOOPBACK_PATH = '/v1/loopback';

function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

function loopbackPayload(endpointScope: string) {
  return {
    version,
    message: '👋 Cron loopback OK 👋',
    endpoint_scope: endpointScope,
  };
}

async function handleLoopback(request: Request): Promise<Response> {
  const expectedScope = cronEndpointScope(request.method, LOOPBACK_PATH);
  const appConfig = await getConfig();
  try {
    const claims = verifyEndpointScopedHandshake(
      request.headers.get('Authorization'),
      appConfig,
      expectedScope,
    );
    return Response.json(loopbackPayload(claims.endpoint_scope ?? expectedScope));
  } catch {
    return unauthorized();
  }
}

/**
 * /v1/loopback — scoped-handshake echo for cron job testing.
 * Accepts any HTTP method; token endpoint_scope must match METHOD:/v1/loopback.
 */
export async function loader(args: Route.LoaderArgs) {
  return handleLoopback(args.request);
}

export async function action(args: Route.ActionArgs) {
  return handleLoopback(args.request);
}
