import type { Route } from './+types/route';
import { withAppAdminContext } from '@curvenote/scms-server';
import { PageFrame, joinPageTitle, getBrandingFromMetaMatches } from '@curvenote/scms-core';
import { dbGetUsers } from './db.server';
import { UserCard } from './UserCard';

export async function loader(args: Route.LoaderArgs) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  await withAppAdminContext(args, { redirectTo: '/app' });
  const users = await dbGetUsers();
  return { users };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Discovery: People', branding.title) }];
};

export default function DiscoveryPeople({ loaderData }: Route.ComponentProps) {
  const { users } = loaderData;

  return (
    <PageFrame
      title="Discover: People"
      description="Search and discover the people connected to your work"
      className="max-w-screen-xl mx-auto"
    >
      <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {users.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
    </PageFrame>
  );
}
