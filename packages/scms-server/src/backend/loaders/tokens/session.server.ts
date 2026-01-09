import type { Context } from '@curvenote/scms-core';
import { error401, error404, httpError } from '@curvenote/scms-core';
import { createSessionToken, verifySessionToken } from '../../sign.tokens.server.js';
import {
  dbGetUser,
  dbTouchUserToken,
  prepareTokenFromString,
  validateUserJWT,
} from './user.server.js';

export async function login(ctx: Context, tokenHeader: string) {
  // we are not expecting ctx.user to be set here, as the user token has not yet been validated
  const verified = await validateUserJWT(ctx, tokenHeader);

  const user = await dbGetUser(verified.userId);
  if (!user) throw error404('User not found');

  const [userId, tokenId] = verified.sub.split('/');
  await dbTouchUserToken(userId, tokenId);
  return createSessionToken(
    user,
    ctx.$config.api.sessionTokenAudience,
    ctx.$config.api.sessionTokenIssuer,
    verified.token.description,
    ctx.$config.api.tokenConfigUrl,
    ctx.$config.api.jwtSigningSecret,
  );
}

export function validateSessionJWT(ctx: Context, tokenString: string) {
  const { toVerify, nonVerifiedToken } = prepareTokenFromString(tokenString);
  if (typeof nonVerifiedToken === 'string' || nonVerifiedToken == null) throw error401();
  if (!nonVerifiedToken.iss?.endsWith('/tokens/session'))
    throw httpError(400, 'Invalid token type');
  const verified = verifySessionToken(toVerify, ctx.$config.api.jwtSigningSecret);
  const [userId] = verified.sub.split('/');
  if (!userId) throw error401();
  return { ...verified, userId };
}
