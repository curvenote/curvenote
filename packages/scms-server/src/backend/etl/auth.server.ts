import { error401, httpError, system } from '@curvenote/scms-core';
import { SiteRole, type SystemRole } from '@curvenote/scms-db';
import { getConfig } from '../../app-config.server.js';
import { sessionStorageFactory } from '../../session.server.js';
import { authenticatorFactory } from '../../modules/auth/auth.server.js';
import { Context } from '../context.server.js';
import { decodeTokenPayload } from '../jwt.context.server.js';
import { validateSessionJWT } from '../loaders/tokens/session.server.js';
import { validateUserJWT } from '../loaders/tokens/user.server.js';
import { getPrismaClient } from '../prisma.server.js';
import { getDefaultSystemRoleScopes } from '../roles.server.js';

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

/**
 * JWT verify, then user + site (with admin membership) in parallel.
 */
export async function authorizeEtlSite(
  request: Request,
  siteName: string,
): Promise<{ auth: EtlAuth; site: EtlSite }> {
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
          where: { user_id: userId, role: SiteRole.ADMIN },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  if (!user || user.disabled || user.pending) throw error401();
  if (!site) throw httpError(404, 'Site not found');
  if (site.external) throw httpError(405, 'External sites do not accept submissions');

  const auth: EtlAuth = { userId: user.id, systemRole: user.system_role };
  const systemScopes = getDefaultSystemRoleScopes(auth.systemRole);
  if (!systemScopes.includes(system.admin) && site.site_users.length === 0) {
    throw error401('Site admin access required');
  }

  return { auth, site: { id: site.id, name: site.name } };
}
