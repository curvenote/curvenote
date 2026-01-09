import { data as dataResponse } from 'react-router';
import type { SecureContext } from '@curvenote/scms-server';
import { createRole, updateRole, deleteRole, isRoleNameUnique } from '@curvenote/scms-server';

/**
 * Validate scope format - must be lowercase letters separated by colons (a:b or a:b:c)
 */
function validateScopeFormat(scope: string): boolean {
  // Pattern: lowercase letters, colons, allowing a:b or a:b:c format
  const scopePattern = /^[a-z]+(:[a-z]+)*$/;
  return scopePattern.test(scope);
}

/**
 * Handle creating a new role
 */
export async function handleCreateRole(ctx: SecureContext, formData: FormData) {
  const name = formData.get('name') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const scopesString = formData.get('scopes') as string;

  // Validation
  if (!name || !title || !description) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'Name, title, and description are required',
        },
      },
      { status: 400 },
    );
  }

  // Parse scopes
  const scopes = scopesString
    ? scopesString
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Validate scopes are not empty
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

  // Validate scope format
  const invalidScopes = scopes.filter((scope) => !validateScopeFormat(scope));
  if (invalidScopes.length > 0) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: `Invalid scope format: ${invalidScopes.join(', ')}. Scopes must be lowercase letters separated by colons (e.g., a:b or a:b:c)`,
        },
      },
      { status: 400 },
    );
  }

  // Check if name is unique
  const isUnique = await isRoleNameUnique(name);
  if (!isUnique) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'A role with this name already exists',
        },
      },
      { status: 400 },
    );
  }

  try {
    const role = await createRole({
      name,
      title,
      description,
      scopes,
      createdBy: ctx.user.id,
    });

    return { success: true, role };
  } catch (error) {
    console.error('Failed to create role:', error);
    return dataResponse(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Failed to create role',
        },
      },
      { status: 500 },
    );
  }
}

/**
 * Handle updating an existing role
 */
export async function handleUpdateRole(ctx: SecureContext, formData: FormData) {
  const id = formData.get('id') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const scopesString = formData.get('scopes') as string;

  // Validation
  if (!id || !title || !description) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'ID, title, and description are required',
        },
      },
      { status: 400 },
    );
  }

  // Parse scopes
  const scopes = scopesString
    ? scopesString
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Validate scopes are not empty
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

  // Validate scope format
  const invalidScopes = scopes.filter((scope) => !validateScopeFormat(scope));
  if (invalidScopes.length > 0) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: `Invalid scope format: ${invalidScopes.join(', ')}. Scopes must be lowercase letters separated by colons (e.g., a:b or a:b:c)`,
        },
      },
      { status: 400 },
    );
  }

  try {
    const role = await updateRole(
      id,
      {
        title,
        description,
        scopes,
      },
      ctx.user.id,
    );

    return { success: true, role };
  } catch (error) {
    console.error('Failed to update role:', error);
    return dataResponse(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Failed to update role',
        },
      },
      { status: 500 },
    );
  }
}

/**
 * Handle deleting a role
 */
export async function handleDeleteRole(ctx: SecureContext, formData: FormData) {
  const id = formData.get('id') as string;

  if (!id) {
    return dataResponse(
      {
        error: {
          type: 'validation',
          message: 'Role ID is required',
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await deleteRole(id, ctx.user.id);

    if (!result.success) {
      return dataResponse(
        {
          error: {
            type: 'general',
            message: result.error || 'Failed to delete role',
          },
        },
        { status: 400 },
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete role:', error);
    return dataResponse(
      {
        error: {
          type: 'general',
          message: error instanceof Error ? error.message : 'Failed to delete role',
        },
      },
      { status: 500 },
    );
  }
}
