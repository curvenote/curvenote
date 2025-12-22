import jwt from 'jsonwebtoken';
import type { Context } from '../../context.server.js';
import { error401 } from '@curvenote/scms-core';
import { verifyUserToken } from '../../sign.tokens.server.js';
import { getPrismaClient } from '../../prisma.server.js';

export async function dbGetUser(userId: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
}

export async function dbGetUserToken(userId: string, tokenId: string) {
  const prisma = await getPrismaClient();
  return prisma.userToken.findFirst({
    where: {
      id: tokenId,
      user_id: userId,
    },
  });
}

export async function dbTouchUserToken(userId: string, tokenId: string) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  return prisma.userToken.update({
    where: {
      id: tokenId,
      user_id: userId,
    },
    data: {
      date_last_used: timestamp,
      date_modified: timestamp,
    },
  });
}

export function prepareTokenFromString(tokenString: string) {
  const toVerify = tokenString.startsWith('Bearer ') ? tokenString.slice(7) : tokenString;
  const nonVerifiedToken = jwt.decode(toVerify);
  return { toVerify, nonVerifiedToken };
}

export async function validateUserJWT(ctx: Context, tokenString: string) {
  const { toVerify, nonVerifiedToken } = prepareTokenFromString(tokenString);
  if (typeof nonVerifiedToken === 'string' || nonVerifiedToken == null)
    throw error401('Malformed user token');
  if (!nonVerifiedToken.iss?.endsWith('/tokens/user')) throw error401('Invalid token type');
  const verified = verifyUserToken(
    toVerify,
    ctx.$config.api.userTokenIssuer,
    ctx.$config.api.jwtSigningSecret,
  );
  const [userId, tokenId] = verified.sub.split('/');

  const token = await dbGetUserToken(userId, tokenId);
  if (!token) throw error401('Invalid user token (revoked or expired)');

  return { ...verified, userId, token };
}
