import { registerWorkflow } from './registry.js';
import { getExtensionWorkflows } from '../modules/extensions/workflows.js';
import type { ClientExtension } from '../modules/extensions/types.js';

/**
 * Load workflows from an extension
 * @param extensions The registered extensions
 * @param extensionName The name of the extension
 * @returns void
 */
export function loadExtensionWorkflows(extensions: ClientExtension[], extensionName: string): void {
  const extension = getExtensionWorkflows(extensions, extensionName);
  if (!extension) {
    throw new Error(`Extension ${extensionName} not found`);
  }
  // Register each workflow from the extension
  for (const workflow of extension.workflows) {
    const workflowName = `${extensionName}:${workflow.name}`;
    registerWorkflow(workflowName, workflow);
  }
}
