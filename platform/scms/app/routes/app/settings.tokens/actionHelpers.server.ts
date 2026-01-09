import type { Route } from './+types/route';
import { data } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import { dbCreateUserToken, dbDeleteUserToken, dtoUserToken } from './db.server';
import { TrackEvent } from '@curvenote/scms-core';
import { createUserToken, SlackEventType } from '@curvenote/scms-server';
import { withAppContext, type SecureContext } from '@curvenote/scms-server';

const CreateUserTokenObject = {
  description: zfd.text(z.string().trim()),
  expiry: zfd.text(
    z.union([
      z.literal('NEVER'),
      z.literal('FIVE_MINUTES'),
      z.literal('ONE_DAY'),
      z.literal('SEVEN_DAYS'),
      z.literal('THIRTY_DAYS'),
      z.literal('SIXTY_DAYS'),
      z.literal('NINETY_DAYS'),
      z.literal('ONE_YEAR'),
    ]),
  ),
};

export function tokenExpiryToDays(expiry?: string) {
  switch (expiry) {
    case 'FIVE_MINUTES':
      return (5 * 60) / 24 / 3600;
    case 'ONE_DAY':
      return 1;
    case 'SEVEN_DAYS':
      return 7;
    case 'THIRTY_DAYS':
      return 30;
    case 'SIXTY_DAYS':
      return 60;
    case 'NINETY_DAYS':
      return 90;
    case 'ONE_YEAR':
      return 365;
    default:
      return undefined;
  }
}

export function tokenExpiryToTimestamp(expiry?: string) {
  const days = tokenExpiryToDays(expiry);
  if (!days) return undefined;
  return Date.now() + days * 24 * 3600 * 1000;
}

export async function actionCreateUserToken(ctx: SecureContext, formData: FormData) {
  const userId = ctx.user.id;
  const CreateUserTokenSchema = zfd.formData(CreateUserTokenObject);
  let payload;
  try {
    payload = CreateUserTokenSchema.parse(Object.fromEntries(formData));
  } catch (error: any) {
    console.error(`Invalid form data ${error}`);
    return data({ error: error.message }, { status: 422 });
  }
  const { description, expiry } = payload;
  const timestampExpires = tokenExpiryToTimestamp(expiry);
  const dateExpires = timestampExpires ? new Date(timestampExpires).toISOString() : undefined;
  const token = await dbCreateUserToken(userId, description, dateExpires);
  const signedToken = createUserToken(
    ctx.user,
    token.id,
    ctx.$config.api.userTokenAudience,
    ctx.$config.api.userTokenIssuer,
    description,
    ctx.$config.api.tokenConfigUrl,
    ctx.$config.api.jwtSigningSecret,
    timestampExpires ? timestampExpires / 1000 : undefined,
  );

  // Send Slack notification for token creation
  await ctx.sendSlackNotification({
    eventType: SlackEventType.USER_TOKEN_CREATED,
    message: `User token created by ${ctx.user.display_name || ctx.user.id}`,
    user: ctx.user,
    metadata: {
      tokenId: token.id,
      expiry: expiry,
      ...(dateExpires ? { expiresAt: dateExpires } : {}),
    },
  });

  await ctx.trackEvent(TrackEvent.USER_TOKEN_CREATED, {
    tokenId: token.id,
    description: description,
    expiry: expiry,
    expiresAt: dateExpires,
  });

  await ctx.analytics.flush();

  const dto = dtoUserToken(token);

  return { token: signedToken, ...dto };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppContext(args);
  const formData = await args.request.formData();
  const formAction = formData.get('formAction');

  if (typeof formAction !== 'string') throw new Error('Invalid form action');

  if (formAction === 'delete') {
    const tokenId = formData.get('tokenId');
    if (typeof tokenId === 'string') {
      const result = await dbDeleteUserToken(ctx, tokenId);

      if (result.count > 0) {
        await ctx.sendSlackNotification({
          eventType: SlackEventType.USER_TOKEN_DELETED,
          message: `User token deleted by ${ctx.user.display_name || ctx.user.id}`,
          user: ctx.user,
          metadata: {
            tokenId,
          },
        });

        await ctx.trackEvent(TrackEvent.USER_TOKEN_DELETED, {
          tokenId: tokenId,
        });

        await ctx.analytics.flush();
      }

      return result;
    }
  } else if (formAction === 'create') {
    const result = await actionCreateUserToken(ctx, formData);
    return result;
  }

  throw new Error('Unknown form action');
}
