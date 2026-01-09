import type { Route } from './+types/route';
import { withAppPlatformAdminContext, getRoles } from '@curvenote/scms-server';
import { PageFrame, SectionWithHeading } from '@curvenote/scms-core';
import { RolesList } from './RolesList';
import { AddRoleForm } from './AddRoleForm';
import { GraduationCap } from 'lucide-react';
import { data } from 'react-router';
import { handleCreateRole, handleUpdateRole, handleDeleteRole } from './actionHelpers.server';
import type { GeneralError } from '@curvenote/scms-core';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Role Management - System Administration' },
    { name: 'description', content: 'Manage custom roles and permissions' },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  await withAppPlatformAdminContext(args);
  const roles = await getRoles();
  return { roles };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppPlatformAdminContext(args);

  const formData = await args.request.formData();
  const intent = formData.get('intent');

  if (typeof intent !== 'string' || intent.length === 0) {
    return data(
      { error: { type: 'general', message: 'Intent not set' } as GeneralError },
      { status: 400 },
    );
  }

  try {
    switch (intent) {
      case 'create':
        return handleCreateRole(ctx, formData);
      case 'update':
        return handleUpdateRole(ctx, formData);
      case 'delete':
        return handleDeleteRole(ctx, formData);
      default:
        return data(
          { error: { type: 'general', message: `Invalid intent: ${intent}` } as GeneralError },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Action error:', error);
    return data(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        } as GeneralError,
      },
      { status: 500 },
    );
  }
}

export default function RolesPage({ loaderData }: Route.ComponentProps) {
  const { roles } = loaderData;

  const breadcrumbs = [
    { label: 'System Administration', href: '/app/system' },
    { label: 'Roles', isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Role Management"
      subtitle="Create and manage custom roles with specific permissions"
      className="max-w-screen-lg mx-auto"
      breadcrumbs={breadcrumbs}
    >
      <div className="space-y-8">
        <AddRoleForm />

        <SectionWithHeading heading="Existing Roles" icon={GraduationCap}>
          <RolesList roles={roles} />
        </SectionWithHeading>
      </div>
    </PageFrame>
  );
}
