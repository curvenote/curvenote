import type { Route } from './+types/route';
import { withAppContext } from '@curvenote/scms-server';
import {
  PageFrame,
  primitives,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import { dbListUserTokens, dtoUserToken } from './db.server';
import { UserToken } from './UserToken';
import { CreateUserToken } from './CreateUserToken';
import { useState } from 'react';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppContext(args);
  const tokensDBO = await dbListUserTokens(ctx.user.id);
  const tokens = tokensDBO.map((token) => dtoUserToken(token));
  return { tokens };
}

export { action } from './actionHelpers.server';

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
