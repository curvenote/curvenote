import type { Route } from './+types/v1.routers.$domain';
import { error404 } from '@curvenote/scms-core';
import { withContext, getPrismaClient } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const { domain } = args.params;
  if (!domain) throw error404();
  const prisma = await getPrismaClient();
  const dnsRouter = await prisma.dnsRouter.findFirst({
    where: { domain },
  });
  if (dnsRouter) {
    return Response.json({
      cdn: dnsRouter.cdn,
      cdn_key: dnsRouter.cdn_key,
      domain: dnsRouter.domain,
      owner: dnsRouter.owner,
    });
  }
  try {
    const legacyRouter: any = await fetch(`${ctx.$config.api.editorApiUrl}/routers/${domain}`, {
      headers: { Accept: 'application/json' },
    });
    if (!legacyRouter.ok) throw error404();
    const { cdn } = await legacyRouter.json();
    if (!cdn) throw error404();
    return Response.json({
      // cdn: <default cdn? or blank?>,
      cdn_key: cdn,
      domain,
    });
  } catch {
    throw error404();
  }
}
