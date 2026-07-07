import { CronEndpointScopes, error405, version } from '@curvenote/scms-core';
import { getConfig, verifyEndpointScopedHandshake } from '@curvenote/scms-server';
import type { Route } from './+types/route';

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

export function loader() {
  throw error405();
}

/**
 * POST /v1/loopback — scoped-handshake echo for cron job testing.
 * Secured with endpoint-scoped handshake (POST:/v1/loopback).
 */
export async function action(args: Route.ActionArgs) {
  if (args.request.method !== 'POST') {
    throw error405();
  }

  const appConfig = await getConfig();
  try {
    const claims = verifyEndpointScopedHandshake(
      args.request.headers.get('Authorization'),
      appConfig,
      CronEndpointScopes.LOOPBACK,
    );
    return Response.json(loopbackPayload(claims.endpoint_scope ?? CronEndpointScopes.LOOPBACK));
  } catch {
    return unauthorized();
  }
}
