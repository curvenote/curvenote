import type { Config } from '@/types/app-config.js';
import type { ClientExtension } from './types.js';
import type { WorkflowRegistration } from '../../workflow/types.js';

export function getExtensionWorkflows(
  extensions: ClientExtension[],
  extensionName: string,
): WorkflowRegistration | undefined {
  const extension = extensions.find((ext) => ext.id.toLowerCase() === extensionName.toLowerCase());
  if (!extension) {
    return undefined;
  }
  return extension.getWorkflows?.();
}

/**
 * Convert extensions to their workflow registrations
 * Similar to registerExtensionJobs but for workflows
 */
export function registerExtensionWorkflows(extensions: ClientExtension[]): WorkflowRegistration[] {
  return extensions
    .map((ext) => ext.getWorkflows?.())
    .filter((reg): reg is WorkflowRegistration => reg !== undefined);
}

export function getEnabledExtensionWorkflowNames(config: Config): string[] {
  const extensions = config.app?.extensions || {};
  return (
    Object.entries(extensions)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, extConfig]) => extConfig?.workflows)
      .map(([name]) => name)
  );
}
