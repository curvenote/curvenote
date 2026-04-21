import type { Route } from './+types/route';
import { withAppPlatformAdminContext, getRoles } from '@curvenote/scms-server';
import { PageFrame, SectionWithHeading, ui } from '@curvenote/scms-core';
import { RolesList } from './RolesList';
import { AddRoleForm } from './AddRoleForm';
import { GraduationCap } from 'lucide-react';
import { data } from 'react-router';
import { handleCreateRole, handleUpdateRole, handleDeleteRole } from './actionHelpers.server';
import {
  handleDeleteSystemRoleScopes,
  handleUpdateSystemRoleScopes,
} from './systemRoleActionHelpers.server';
import type { GeneralError } from '@curvenote/scms-core';
import { SystemRoleScopesEditor } from './SystemRoleScopesEditor';
import { getAllSystemRoleScopes } from './systemRoleScopes.server';
import { flattenScopeTree } from './flattenScopeTree';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Role Management - System Administration' },
    { name: 'description', content: 'Manage custom roles and permissions' },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  await withAppPlatformAdminContext(args);
  const { extensions: serverExtensions } = await import('../../../extensions/server');
  const [roles, systemRoleScopes] = await Promise.all([getRoles(), getAllSystemRoleScopes()]);
  const extensionScopes = serverExtensions.flatMap((extension) => {
    const tree = extension.getScopes?.();
    if (!tree) return [];
    return flattenScopeTree(tree);
  });
  return { roles, systemRoleScopes, extensionScopes: Array.from(new Set(extensionScopes)).sort() };
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
      case 'system-role-update':
        return handleUpdateSystemRoleScopes(ctx, formData);
      case 'system-role-delete':
        return handleDeleteSystemRoleScopes(ctx, formData);
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
  const { roles, systemRoleScopes, extensionScopes } = loaderData;

  const breadcrumbs = [
    { label: 'System Administration', href: '/app/system' },
    { label: 'Roles', isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Role Management"
      subtitle="Create and manage custom roles with specific permissions"
      className="mx-auto max-w-screen-lg"
      breadcrumbs={breadcrumbs}
    >
      <ui.Tabs defaultValue="custom-roles" className="space-y-2">
        <ui.TabsList>
          <ui.TabsTrigger value="custom-roles">Custom Roles</ui.TabsTrigger>
          <ui.TabsTrigger value="system-roles">System Roles</ui.TabsTrigger>
        </ui.TabsList>

        <ui.TabsContent value="custom-roles" className="space-y-2">
          <AddRoleForm />

          <SectionWithHeading heading="Existing Roles" icon={GraduationCap}>
            <RolesList roles={roles} />
          </SectionWithHeading>
        </ui.TabsContent>

        <ui.TabsContent value="system-roles">
          <SectionWithHeading heading="System Roles">
            <SystemRoleScopesEditor roles={systemRoleScopes} extensionScopes={extensionScopes} />
          </SectionWithHeading>
        </ui.TabsContent>
      </ui.Tabs>
    </PageFrame>
  );
}
