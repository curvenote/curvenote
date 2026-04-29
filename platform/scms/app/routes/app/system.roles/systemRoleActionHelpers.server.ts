import { data as dataResponse } from 'react-router';
import type { SecureContext } from '@curvenote/scms-server';
import { getInvalidScopes, parseScopes } from './scopeValidation';
import { deleteSystemRoleScopes, updateSystemRoleScopes } from './systemRoleScopes.server';

export async function handleUpdateSystemRoleScopes(ctx: SecureContext, formData: FormData) {
  const role = formData.get('role');
  const scopesString = formData.get('scopes');

  if (typeof role !== 'string' || role.length === 0) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'System role is required',
        },
      },
      { status: 400 },
    );
  }

  const scopes = parseScopes(typeof scopesString === 'string' ? scopesString : undefined);
  if (scopes.length === 0) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'At least one scope is required',
        },
      },
      { status: 400 },
    );
  }

  const invalidScopes = getInvalidScopes(scopes);
  if (invalidScopes.length > 0) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: `Invalid scope format: ${invalidScopes.join(', ')}. Scopes must be lowercase letters, numbers, hyphens, and colon-delimited segments (e.g., app:settings:account:read or ext:plugin:action)`,
        },
      },
      { status: 400 },
    );
  }

  try {
    const systemRole = await updateSystemRoleScopes(role, scopes, ctx.user.id);
    return { success: true, systemRole };
  } catch (error) {
    return dataResponse(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Failed to update system role scopes',
        },
      },
      { status: 500 },
    );
  }
}

export async function handleDeleteSystemRoleScopes(ctx: SecureContext, formData: FormData) {
  const role = formData.get('role');
  if (typeof role !== 'string' || role.length === 0) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'System role is required',
        },
      },
      { status: 400 },
    );
  }

  try {
    const systemRole = await deleteSystemRoleScopes(role, ctx.user.id);
    return { success: true, systemRole };
  } catch (error) {
    return dataResponse(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Failed to delete system role scopes',
        },
      },
      { status: 500 },
    );
  }
}
