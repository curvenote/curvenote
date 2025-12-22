import type { Route } from './+types/route.check-accounts-linked';
import { redirect } from 'react-router';
import { withContext } from '@curvenote/scms-server';
import { checkAccountsLinkedStatus } from './actionHelpers.server';

/**
 * Loader function that checks if a user has linked all required authentication providers
 * and updates their signup progress accordingly.
 *
 * This function:
 * 1. Validates user authentication
 * 2. Determines required providers from signup configuration
 * 3. Checks which providers the user has successfully linked
 * 4. Updates the link-providers step completion status
 * 5. Enriches user data from linked providers if needed
 * 6. Redirects back to the signup flow
 *
 * @param args - Remix loader function arguments
 * @returns Redirect to login if not authenticated, or to pending signup page
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  // Ensure user is authenticated before proceeding
  if (!ctx.user) {
    throw redirect('/login');
  }

  await checkAccountsLinkedStatus(ctx);

  // Redirect back to the signup flow to continue the process
  throw redirect('/new-account/pending');
}
