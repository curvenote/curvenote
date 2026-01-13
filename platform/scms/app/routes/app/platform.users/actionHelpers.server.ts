import type { Config } from '@/types/app-config';
import { dbUpdateUserNullFields } from './db.server';
import { assignRoleToUser, removeRoleFromUser, getRoles } from '@curvenote/scms-server';
import { data as dataResponse } from 'react-router';
import type { SecureContext } from '@curvenote/scms-server';

export async function actionUpdateUserFromEditorAPI(config: Config, userId: string) {
  // fetch username
  const url = `${config.api?.editorApiUrl}/users/${userId}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const message = `Failed to fetch username for (${userId}): ${resp.statusText}`;
    console.error(message);
    throw new Error(message);
  }
  const { username, display_name } = await resp.json();

  return dbUpdateUserNullFields(userId, { username, display_name });
}

/**
 * Handle assigning a role to a user
 */
export async function handleAssignRole(ctx: SecureContext, formData: FormData) {
  const userId = formData.get('userId') as string;
  const roleId = formData.get('roleId') as string;

  if (!userId || !roleId) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'User ID and Role ID are required',
        },
      },
      { status: 400 },
    );
  }

  try {
    const userRole = await assignRoleToUser({
      userId,
      roleId,
      assignedBy: ctx.user.id,
    });

    return { success: true, userRole };
  } catch (error) {
    console.error('Failed to assign role:', error);
    return dataResponse(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Failed to assign role',
        },
      },
      { status: 500 },
    );
  }
}

/**
 * Handle removing a role from a user
 */
export async function handleRemoveRole(ctx: SecureContext, formData: FormData) {
  const userRoleId = formData.get('userRoleId') as string;

  if (!userRoleId) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'User Role ID is required',
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await removeRoleFromUser(userRoleId, ctx.user.id);

    if (!result.success) {
      return dataResponse(
        {
          error: {
            type: 'general',
            message: result.error || 'Failed to remove role',
          },
        },
        { status: 400 },
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to remove role:', error);
    return dataResponse(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Failed to remove role',
        },
      },
      { status: 500 },
    );
  }
}

/**
 * Get available roles for assignment (excludes roles user already has)
 */
export async function getAvailableRolesForUser() {
  const allRoles = await getRoles();

  // For now, return all roles - we'll filter in the component
  return allRoles;
}
