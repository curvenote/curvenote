import type { Route } from './+types/route';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  TrackEvent,
  KnownResendEvents,
} from '@curvenote/scms-core';
import { withAppPlatformAdminContext, SlackEventType } from '@curvenote/scms-server';
import { dbCreateUserWithOrcidAccount, validateUserUniqueness } from './db.server';
import { AddUserForm } from './AddUserForm';

export async function loader(args: Route.LoaderArgs) {
  await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  return null;
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppPlatformAdminContext(args);
  const formData = await args.request.formData();
  const formAction = formData.get('formAction') as string;

  try {
    switch (formAction) {
      case 'create-user-with-orcid': {
        const username = formData.get('username') as string;
        const email = formData.get('email') as string;
        const displayName = formData.get('displayName') as string;
        const orcidId = formData.get('orcidId') as string;

        // Basic validation - all fields required
        if (!username || !email || !displayName || !orcidId) {
          return { error: 'All fields are required' };
        }

        // Validate ORCID ID format
        const orcidRegex = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
        if (!orcidRegex.test(orcidId.trim())) {
          return { error: 'Invalid ORCID ID format. Expected format: 0000-0000-0000-0000' };
        }

        // Check for duplicates
        const validationResult = await validateUserUniqueness({
          username: username.trim(),
          email: email.trim(),
          orcidId: orcidId.trim(),
        });

        if (validationResult.error) {
          return { error: validationResult.error };
        }

        try {
          const newUser = await dbCreateUserWithOrcidAccount({
            username: username.trim(),
            email: email.trim(),
            displayName: displayName.trim(),
            orcidId: orcidId.trim(),
          });

          await ctx.identifyEvent(newUser);

          if (newUser.email) {
            await ctx.sendEmail({
              eventType: KnownResendEvents.USER_WELCOME,
              to: newUser.email,
              subject: 'Welcome!',
              templateProps: {
                approval: false,
              },
            });
          }

          await ctx.sendSlackNotification({
            eventType: SlackEventType.USER_CREATED,
            message: `New user${newUser.username ? ` *${newUser.username}*` : ''} provisioned in PLATFORM interface via orcid`,
            user: newUser,
            metadata: {
              provider: 'orcid',
              username: newUser.username,
              displayName: newUser.display_name,
            },
          });

          await ctx.trackEvent(TrackEvent.USER_CREATED, {
            createdUserId: newUser.id,
            createdUserEmail: newUser.email,
            createdUserUsername: newUser.username,
            createdUserDisplayName: newUser.display_name,
            provider: 'orcid',
            orcidId: orcidId.trim(),
          });
          await ctx.analytics.flush();
          return { success: true, user: newUser };
        } catch (error: any) {
          console.error('Error creating user:', error);
          return { error: `Failed to create user: ${error.message}` };
        }
      }
      default: {
        throw new Error('Invalid form action');
      }
    }
  } catch (error: any) {
    console.log('error', error);
    return { error: error.message };
  }
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Onboarding', 'Platform Administration', branding.title) }];
};

export default function PlatformOnboarding() {
  return (
    <PageFrame title="Onboarding">
      <AddUserForm />
    </PageFrame>
  );
}
