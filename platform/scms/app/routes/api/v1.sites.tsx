import type { Route } from './+types/v1.sites';
import type { Prisma } from '@prisma/client';
import { withContext, sites } from '@curvenote/scms-server';

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
    return Response.json(dto);
  }
  where = {
    ...where,
    private: false,
  };
  const dto = await sites.list(ctx, where);
  return Response.json(dto);
}
