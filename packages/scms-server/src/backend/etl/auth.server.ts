import { error401, httpError, system, site as siteScopes } from '@curvenote/scms-core';
import { SiteRole, type SystemRole } from '@curvenote/scms-db';
import { getConfig } from '../../app-config.server.js';
import { sessionStorageFactory } from '../../session.server.js';
import { authenticatorFactory } from '../../modules/auth/auth.server.js';
import { Context } from '../context.server.js';
import { decodeTokenPayload } from '../jwt.context.server.js';
import { validateSessionJWT } from '../loaders/tokens/session.server.js';
import { validateUserJWT } from '../loaders/tokens/user.server.js';
import { getPrismaClient } from '../prisma.server.js';
import { getDefaultSystemRoleScopes, hasSiteScope } from '../roles.server.js';

export type EtlAuth = {
  userId: string;
  systemRole: SystemRole | null;
};

export type EtlSite = {
  id: string;
  name: string;
};

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('Authorization');
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] ?? header).trim() || undefined;
}

export async function verifyEtlBearerUserId(request: Request): Promise<string> {
  const token = bearerToken(request);
  if (!token) throw error401('Missing bearer token');

  const [config, auth, sessionStorage] = await Promise.all([
    getConfig(),
    authenticatorFactory(),
    sessionStorageFactory(),
  ]);
  const ctx = new Context(config, auth, sessionStorage, request);
  const payload = decodeTokenPayload(token);
  if (payload?.iss?.endsWith('/tokens/session')) {
    return validateSessionJWT(ctx, token).userId;
  }
  if (payload?.iss?.endsWith('/tokens/user')) {
    return (await validateUserJWT(ctx, token)).userId;
  }
  throw error401('Invalid token type');
}

type EtlUserSiteLoad = {
  auth: EtlAuth;
  site: EtlSite & { site_users: { role: SiteRole }[] };
};

async function loadEtlUserAndSite(request: Request, siteName: string): Promise<EtlUserSiteLoad> {
  const userId = await verifyEtlBearerUserId(request);
  const prisma = await getPrismaClient();

  const [user, site] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, disabled: true, pending: true, system_role: true },
    }),
    prisma.site.findUnique({
      where: { name: siteName },
      select: {
        id: true,
        name: true,
        external: true,
        site_users: {
          where: { user_id: userId },
          select: { role: true },
        },
      },
    }),
  ]);

  if (!user || user.disabled || user.pending) throw error401();
  if (!site) throw httpError(404, 'Site not found');
  if (site.external) throw httpError(405, 'External sites do not accept submissions');

  return {
    auth: { userId: user.id, systemRole: user.system_role },
    site: { id: site.id, name: site.name, site_users: site.site_users },
  };
}

function hasSystemAdmin(systemRole: SystemRole | null): boolean {
  return getDefaultSystemRoleScopes(systemRole).includes(system.admin);
}

/**
 * JWT verify, then user + site. Requires system.admin or SiteRole.ADMIN membership.
 */
export async function authorizeEtlSite(
  request: Request,
  siteName: string,
): Promise<{ auth: EtlAuth; site: EtlSite }> {
  const { auth, site } = await loadEtlUserAndSite(request, siteName);
  const isSiteAdmin = site.site_users.some((su) => su.role === SiteRole.ADMIN);
  if (!hasSystemAdmin(auth.systemRole) && !isSiteAdmin) {
    throw error401('Site admin access required');
  }

  return { auth, site: { id: site.id, name: site.name } };
}

/**
 * JWT verify, then user + site. Requires system.admin or site:history via any site role
 * (including SiteRole.FEED).
 */
export async function authorizeEtlHistory(
  request: Request,
  siteName: string,
): Promise<{ auth: EtlAuth; site: EtlSite }> {
  const { auth, site } = await loadEtlUserAndSite(request, siteName);
  const hasHistory = site.site_users.some((su) => hasSiteScope(su.role, siteScopes.history));
  if (!hasSystemAdmin(auth.systemRole) && !hasHistory) {
    throw error401('Site history access required');
  }

  return { auth, site: { id: site.id, name: site.name } };
}
