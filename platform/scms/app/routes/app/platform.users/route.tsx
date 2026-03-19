import type { Route } from './+types/route';
import { withAppPlatformAdminContext, getRoles, withValidFormData } from '@curvenote/scms-server';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
} from '@curvenote/scms-core';
import {
  approveAndNotifyUser,
  dbCountUsers,
  dbGetUsers,
  dbGetUserByIdForAnalytics,
  dbRejectUser,
  dbToggleUserDisabled,
} from './db.server';
import { handleAssignRole, handleRemoveRole } from './actionHelpers.server';
import { PlatformUserList } from './PlatformUserList';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

// Zod schema for form validation
const PlatformUserActionSchema = zfd.formData({
  intent: z.enum(['toggle-disabled', 'approve-user', 'reject-user', 'assign-role', 'remove-role']),
  userId: zfd.text(z.string()),
  disabled: zfd.text(z.string().transform((val) => val === 'true')).optional(),
  roleId: zfd.text(z.string()).optional(),
  userRoleId: zfd.text(z.string()).optional(),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const [total, items, availableRoles] = await Promise.all([
    dbCountUsers(),
    dbGetUsers(),
    getRoles(),
  ]);

  return {
    scopes: ctx.scopes,
    total,
    items,
    availableRoles,
  };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const formData = await args.request.formData();

  return withValidFormData(PlatformUserActionSchema, formData, async (payload) => {
    switch (payload.intent) {
      case 'approve-user': {
        await approveAndNotifyUser(ctx, payload.userId);
        const updatedUser = await dbGetUserByIdForAnalytics(payload.userId);
        await ctx.identifyEvent(updatedUser);
        await ctx.trackEvent(TrackEvent.USER_APPROVED, {
          targetUserId: payload.userId,
        });
        await ctx.analytics.flush();
        return { success: true };
      }
      case 'reject-user': {
        const user = await dbRejectUser(payload.userId, ctx.user.id);
        const updatedUser = await dbGetUserByIdForAnalytics(payload.userId);
        await ctx.identifyEvent(updatedUser);
        await ctx.trackEvent(TrackEvent.USER_REJECTED, {
          targetUserId: payload.userId,
          targetUserEmail: user?.email,
          targetUserDisplayName: user?.display_name,
        });
        await ctx.analytics.flush();
        return { success: true, user };
      }
      case 'toggle-disabled': {
        if (payload.disabled === undefined) {
          throw new Error('disabled field is required for toggle-disabled intent');
        }
        const user = await dbToggleUserDisabled(payload.userId, payload.disabled, ctx.user.id);
        const updatedUser = await dbGetUserByIdForAnalytics(payload.userId);
        await ctx.identifyEvent(updatedUser);
        await ctx.trackEvent(
          payload.disabled ? TrackEvent.USER_DISABLED : TrackEvent.USER_ENABLED,
          {
            targetUserId: payload.userId,
            targetUserEmail: user?.email,
            targetUserDisplayName: user?.display_name,
          },
        );
        await ctx.analytics.flush();
        return { success: true, user };
      }
      case 'assign-role': {
        const result = await handleAssignRole(ctx, formData);
        const success =
          typeof result === 'object' &&
          result != null &&
          'success' in result &&
          (result as any).success === true;
        if (success) {
          const updatedUser = await dbGetUserByIdForAnalytics(payload.userId);
          await ctx.identifyEvent(updatedUser);
          await ctx.analytics.flush();
        }
        return result;
      }
      case 'remove-role': {
        const result = await handleRemoveRole(ctx, formData);
        const success =
          typeof result === 'object' &&
          result != null &&
          'success' in result &&
          (result as any).success === true;
        if (success) {
          const updatedUser = await dbGetUserByIdForAnalytics(payload.userId);
          await ctx.identifyEvent(updatedUser);
          await ctx.analytics.flush();
        }
        return result;
      }
      default: {
        throw new Error('Invalid intent');
      }
    }
  });
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Users', 'Platform Administration', branding.title) }];
};

export default function PlatformUsers({ loaderData }: Route.ComponentProps) {
  const { total, items, availableRoles } = loaderData;

  return (
    <PageFrame title="Users">
      <div className="mb-4 font-light text-left text-gray-600 dark:text-gray-400">
        Total Users: {total}
      </div>

      <PlatformUserList users={items} availableRoles={availableRoles} />
    </PageFrame>
  );
}
