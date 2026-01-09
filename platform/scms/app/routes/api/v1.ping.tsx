import type { Route } from './+types/v1.ping';
import { httpError } from '@curvenote/scms-core';
import { ensureJsonBodyFromMethod, withContext } from '@curvenote/scms-server';
import { z } from 'zod';

const PingEventSchema = z.object({
  event: z.string(),
  properties: z.record(z.string(), z.any()).optional(),
  anonymous: z.boolean().optional(),
});

export async function action(args: Route.ActionArgs) {
  const ctx = await withContext(args);
  if (args.request.method === 'POST') {
    const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
    const data = PingEventSchema.parse(body);

    await ctx.trackEvent(data.event as any, data.properties ?? {}, { anonymous: data.anonymous });

    await ctx.analytics.flush();

    return Response.json({ success: true });
  }

  throw httpError(405, 'Method not allowed');
}
