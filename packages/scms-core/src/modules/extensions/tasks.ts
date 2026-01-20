import type { ClientExtension, ExtensionTask } from './types.js';
import { scopes } from '../../scopes.js';

/**
 * Gets available scoped tasks from extensions, filtered by extension config and user scopes.
 * Returns a map of extension IDs to arrays of allowed task IDs.
 * Tasks are filtered based on:
 * - Extension config (task: true)
 * - User scopes (user must have all required scopes for each task)
 *
 * @param config - Map of extension IDs to their config (with task flag)
 * @param clientExtensions - Array of client extensions
 * @param userScopes - Array of scopes the user has
 * @returns Map of extension IDs to arrays of allowed task IDs
 */
export function getAvailableScopedTasks(
  config: Record<string, { task?: boolean }>,
  clientExtensions: ClientExtension[],
  userScopes: string[],
): Record<string, string[]> {
  const taskConfig: Record<string, string[]> = {};
  for (const ext of clientExtensions) {
    const extConfig = config[ext.id as keyof typeof config];
    if (extConfig?.task === true && ext.getTasks) {
      const tasks = ext.getTasks();
      taskConfig[ext.id] = tasks
        .filter((task: ExtensionTask) => {
          const taskScopes = task.scopes || [];
          // System admins can see all tasks
          if (userScopes.includes(scopes.system.admin)) return true;
          // If task has scopes defined, user must have all of them
          if (task.scopes && task.scopes.length > 0) {
            if (userScopes.length === 0) return false;
            return taskScopes.every((s) => userScopes.includes(s));
          }
          // Tasks without scopes are always included (backward compatibility)
          return true;
        })
        .map((task) => task.id);
    }
  }
  return taskConfig;
}

/**
 * Gets all available tasks with their components from extensions, filtered by task config.
 * Only includes tasks whose IDs are in the allowed list for their extension.
 * This function must be called client-side only as it returns React components.
 *
 * @param extensions - Array of client extensions
 * @param taskConfig - Optional map of extension IDs to arrays of allowed task IDs
 * @returns Array of extension tasks with components
 */
export function getAvailableTasksWithComponents(
  extensions: ClientExtension[],
  taskConfig?: Record<string, string[]>,
): ExtensionTask[] {
  return extensions.flatMap((extension) => {
    // If no config provided, include all tasks (backward compatibility)
    if (!taskConfig) {
      return extension.getTasks?.() || [];
    }

    const allowedTaskIds = taskConfig[extension.id];
    // If extension not in config or has empty array, no tasks allowed
    if (!allowedTaskIds || allowedTaskIds.length === 0) {
      return [];
    }

    // Filter tasks to only include those whose IDs are in the allowed list
    const allTasks = extension.getTasks?.() || [];
    return allTasks.filter((task) => allowedTaskIds.includes(task.id));
  });
}
