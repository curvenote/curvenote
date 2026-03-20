import type { Route } from './+types/v1.routers';
import { z } from 'zod';
import { uuidv7 as uuid } from 'uuidv7';
import { error405, httpError } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISecureContext,
  withContext,
  getPrismaClient,
} from '@curvenote/scms-server';
import {
  isCurvespaceDomain,
  getCurvespaceParts,
  createCurvespaceDomain,
} from '@curvenote/blocks';

/**
 * Return true if value is (1) valid .curve.space domain or (2) unrelated subdomain
 */
function isCurvespaceOrSubdomain(value: string) {
  if (isCurvespaceDomain(value)) return true;
  if (value.toLowerCase().endsWith('.curve.space')) return false;
  if (!value.startsWith('https://') && !value.startsWith('http://')) {
    value = `http://${value}`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const { hash, host, pathname, protocol, search } = url;
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  if ((pathname && pathname !== '/') || hash || search) return false;
  const numParts = host.split('.').length;
  if (numParts < 3) return false;
  return true;
}

const CreateDnsRouterPostBodySchema = z.object({
  cdn: z
    .string({
      error: (issue) => (issue.input === undefined ? 'cdn is required (url)' : undefined),
    })
    .url(),
  cdn_key: z
    .string({
      error: (issue) => (issue.input === undefined ? 'cdn_key is required (uuid)' : undefined),
    })
    .uuid(),
  domain: z.string().refine(isCurvespaceOrSubdomain, {
    message: 'domain must be valid .curve.space domain or a subdomain you own',
  }),
});

export async function loader(args: Route.LoaderArgs) {
  await withContext(args);
  throw error405();
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISecureContext(args);
  if (args.request.method === 'POST') {
    const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
    const routeData = validate(CreateDnsRouterPostBodySchema, body);
    const prisma = await getPrismaClient();
    let domain = routeData.domain.replace(/^https?:\/\//, '');
    if (isCurvespaceDomain(domain)) {
      const [curvespaceUser, curvespaceSub] = getCurvespaceParts(domain);
      if (!curvespaceUser) throw httpError(400, 'invalid curve.space URL');
      if (ctx.user.username !== curvespaceUser) {
        throw httpError(400, 'invalid username in curve.space URL');
      }
      domain = createCurvespaceDomain(curvespaceUser, curvespaceSub);
    } else {
      const existing = await prisma.dnsRouter.findFirst({
        where: { domain },
      });
      if (existing?.owner !== ctx.user.id) {
        throw httpError(400, 'invalid curve.space URL');
      }
    }
    // Need to deal with teams
    // Probably want to have this on the work.
    // currently, you can update a router for someone else's content - connecting to work perms would be better.
    const now = new Date().toISOString();
    const dnsRouter = await prisma.dnsRouter.create({
      data: {
        id: uuid(),
        cdn: routeData.cdn,
        cdn_key: routeData.cdn_key,
        domain,
        owner: ctx.user.id,
        date_created: now,
        date_modified: now,
        created_by: {
          connect: {
            id: ctx.user.id,
          },
        },
        is_team: false,
      },
    });

    return Response.json(
      {
        cdn: dnsRouter.cdn,
        cdn_key: dnsRouter.cdn_key,
        domain: dnsRouter.domain,
        owner: ctx.user.id,
      },
      { status: 201 },
    );
  }
  throw error405();
}
