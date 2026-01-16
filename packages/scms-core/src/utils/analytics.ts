import { useMyUser } from '../providers/MyUserProvider.js';
import { $Enums } from '@curvenote/scms-db';

export type EventOptions = {
  anonymous?: boolean;
  ignoreAdmin?: boolean;
};

/**
 * Check if the current user has admin privileges
 */
export function isAdmin(user?: { system_role: $Enums.SystemRole | string } | null): boolean {
  if (!user) return false;
  return (
    user.system_role === $Enums.SystemRole.ADMIN ||
    user.system_role === $Enums.SystemRole.PLATFORM_ADMIN
  );
}

/**
 * User-aware ping event hook that can check admin status
 * This version should be used in React components where useMyUser is available
 */
export function usePingEvent() {
  const user = useMyUser();

  return async (
    event: string,
    properties: Record<string, any> = {},
    opts: EventOptions = {},
  ): Promise<void> => {
    if (opts.ignoreAdmin && isAdmin(user)) {
      console.log('Ignoring track event for admin:', event);
      return;
    }

    try {
      const response = await fetch('/v1/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          properties,
          anonymous: opts.anonymous,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to track event:', event, response.status);
      }
    } catch (error) {
      console.warn('Error tracking event:', event, error);
    }
  };
}
