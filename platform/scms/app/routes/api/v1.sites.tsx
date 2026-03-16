import type { Route } from './+types/v1.sites';
import type { Prisma } from '@curvenote/scms-db';
import { withContext, sites } from '@curvenote/scms-server';
import { SEMI_STATIC_BURST_PROTECTION, vercelCacheHeaders } from '../../lib/vercel-cache';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const url = new URL(args.request.url);
  const hostnameParam = url.searchParams.get('hostname');

  // TODO: further restrict access to private site information
  // by verifying the requester as a curvenote theme server using the
  // something signed by the PROPERTY_PUBLIC_KEY
  let where: Prisma.SiteWhereInput = {};
  if (hostnameParam) {
    // This will likely return a length-1 list
    where = {
      ...where,
      domains: { some: { hostname: decodeURIComponent(hostnameParam) } },
    };
    // Use the listing function that includes additional landing content query
    const dto = await sites.listSitesWithContent(ctx, where);
    return Response.json(dto, {
      headers: vercelCacheHeaders(SEMI_STATIC_BURST_PROTECTION),
    });
  }
  where = {
    ...where,
    private: false,
  };
  const dto = await sites.list(ctx, where);

  // Apply burst protection headers
  // We are applying accros the board here but could target
  // - user agent: 'Curvenote Journal Theme v1'
  // - client name header: 'Curvenote Javascript Client`
  // - others...
  // All differently, right now all clients are treated the same.
  const headers = vercelCacheHeaders(SEMI_STATIC_BURST_PROTECTION);
  return Response.json(dto, { headers });
}
