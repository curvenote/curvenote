import type { Route } from './+types/users';
import { data } from 'react-router';
import { error405 } from '@curvenote/scms-core';
import { withAppContext } from '@curvenote/scms-server';
import type { GeneralError } from '@curvenote/scms-core';
import { dbSearchUsers } from './db.server';

// Loader returns 405 - this is an action-only endpoint
export async function loader() {
  throw error405();
}

// Action handles user search requests
export async function action(args: Route.ActionArgs) {
  await withAppContext(args);
  const formData = await args.request.formData();
  const query = formData.get('query');

  // Validate query parameter
  if (typeof query !== 'string' || query.length < 3) {
    return data(
      {
        error: {
          type: 'general',
          message: 'Search query must be at least 3 characters',
        } as GeneralError,
      },
      { status: 400 },
    );
  }

  try {
    const searchResults = await dbSearchUsers(query);
    return { searchResults };
  } catch (error) {
    console.error('User search failed:', error);
    return data(
      { error: { type: 'general', message: 'Search failed' } as GeneralError },
      { status: 500 },
    );
  }
}
