import type { Route } from './+types/route';
import { SlackEventType, withAppScopedContext } from '@curvenote/scms-server';
import {
  PageFrame,
  primitives,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
  TrackEvent,
} from '@curvenote/scms-core';
import { dbDeleteUserToken, dbListUserTokens, dtoUserToken } from './db.server';
import { UserToken } from './UserToken';
import { CreateUserToken } from './CreateUserToken';
import { useState } from 'react';
import { actionCreateUserToken } from './actionHelpers.server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.settings.tokens.read]);
  const tokensDBO = await dbListUserTokens(ctx.user!.id);
  const tokens = tokensDBO.map((token) => dtoUserToken(token));
  return { tokens };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppScopedContext(args, [scopes.app.settings.tokens.manage]);
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

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('My Tokens', branding.title) }];
};

export default function Tokens({ loaderData }: Route.ComponentProps) {
  const [done, setDone] = useState(false);
  const { tokens } = loaderData;
  return (
    <PageFrame
      title="My Tokens"
      subtitle="Manage your API tokens"
      description="API Tokens give full access to your account and should be kept secret. Revoke a token at any time by deleting it."
    >
      <div className="space-y-8">
        <CreateUserToken done={done} setDone={setDone} />
        {tokens.length > 0 && (
          <primitives.Card lift>
            <ul className="divide-y divide-stone-600 dark:divide-stone-300">
              {tokens.map((token) => (
                <UserToken key={token.id} token={token} onDelete={() => setDone(true)} />
              ))}
            </ul>
          </primitives.Card>
        )}
      </div>
    </PageFrame>
  );
}
