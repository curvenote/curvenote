import type { Route } from './+types/route';
import { withSecureWorkContext } from '@curvenote/scms-server';
import {
  PageFrame,
  UserCard,
  getBrandingFromMetaMatches,
  joinPageTitle,
  SectionWithHeading,
  scopes,
} from '@curvenote/scms-core';
import { WorkRolesForm } from './WorkRolesForm';
import { dbGetWorkUsers, dtoWorkUsers } from './db.server';
import { User } from 'lucide-react';
import { data } from 'react-router';
import type { GeneralError } from '@curvenote/scms-core';
import { actionGrantUserRole, actionRevokeUserRole } from './actionHelpers.server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.users.read]);
  const dbo = await dbGetWorkUsers(ctx.work.id);
  if (!dbo) return { work: ctx.workDTO, error: 'Failed to get work users', users: [] };
  const users = dtoWorkUsers(dbo);
  return { work: ctx.workDTO, users };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Work Access', branding.title) }];
};

export async function action(args: Route.ActionArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.users.update]);

  const formData = await args.request.formData();
  const intent = formData.get('intent');

  if (typeof intent !== 'string' || intent.length === 0) {
    return data(
      { error: { type: 'general', message: 'Intent not set' } as GeneralError },
      { status: 400 },
    );
  }

  if (intent === 'grant') {
    return actionGrantUserRole(ctx, formData);
  } else if (intent === 'revoke') {
    return actionRevokeUserRole(ctx, formData);
  }

  return data(
    { error: { type: 'general', message: 'Invalid intent' } as GeneralError },
    { status: 400 },
  );
}

export default function Users({ loaderData }: Route.ComponentProps) {
  const { work, users } = loaderData;

  const truncatedTitle = work.title
    ? work.title.length > 32
      ? work.title.substring(0, 32) + '...'
      : work.title
    : 'Untitled Work';

  const breadcrumbs = [
    { label: 'Works', href: '/app/works' },
    { label: truncatedTitle, href: `/app/works/${work.id}` },
    { label: 'Users', isCurrentPage: true },
  ];

  return (
    <PageFrame title="Users" subtitle="Who can access this work?" breadcrumbs={breadcrumbs}>
      <div className="flex flex-col space-y-5">
        <div>
          <WorkRolesForm />
        </div>
        <SectionWithHeading heading="Current Users" icon={User}>
          <div className="overflow-hidden rounded-sm border bg-background">
            {users.map((u) => (
              <UserCard
                key={u.id}
                name={u.display_name}
                roles={u.work_roles}
                email={u.email}
                userId={u.id}
              />
            ))}
          </div>
        </SectionWithHeading>
      </div>
    </PageFrame>
  );
}
