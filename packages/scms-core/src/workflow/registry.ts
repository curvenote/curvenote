import type { Config } from '@/types/app-config.js';
import type { Workflow, WorkflowRegistration } from './types.js';
import { SIMPLE_PUBLIC_WORKFLOW } from './simple.js';
import { PRIVATE_SITE_WORKFLOW } from './private.js';
import { OPEN_REVIEW_WORKFLOW } from './openReview.js';
import { CLOSED_REVIEW_WORKFLOW } from './closedReview.js';
import {
  getEnabledExtensionWorkflowNames,
  getExtensionWorkflows,
} from '../modules/extensions/workflows.js';
import type { ClientExtension } from '../modules/extensions/types.js';

// Internal registry of workflows
const workflowRegistry = new Map<string, Workflow>();

// Track which core workflows have been registered
let coreWorkflowsRegistered = false;

/**
 * Register core workflows if they haven't been registered yet
 */
function ensureCoreWorkflowsRegistered() {
  if (coreWorkflowsRegistered) return;

  registerWorkflow('SIMPLE', SIMPLE_PUBLIC_WORKFLOW);
  registerWorkflow('PRIVATE', PRIVATE_SITE_WORKFLOW);
  registerWorkflow('OPEN_REVIEW', OPEN_REVIEW_WORKFLOW);
  registerWorkflow('CLOSED_REVIEW', CLOSED_REVIEW_WORKFLOW);

  coreWorkflowsRegistered = true;
}

/**
 * Register a workflow with the given name
 * @param name The name of the workflow
 * @param workflow The workflow to register
 * @returns The registered workflow name
 */
export function registerWorkflow(name: string, workflow: Workflow): string {
  if (workflowRegistry.has(name)) {
    console.warn(`Workflow ${name} is being overridden`);
  }
  workflowRegistry.set(name, workflow);
  return name;
}

/**
 * Register multiple workflows directly (internal helper)
 * @param workflows Array of workflows to register
 * @returns Array of registered workflow names
 */
export function registerWorkflowsDirectly(workflows: Workflow[]): string[] {
  return workflows.map((workflow) => registerWorkflow(workflow.name, workflow));
}

/**
 * Get a workflow by name, ensuring it's registered first
 * @param config The app configuration
 * @param extensionWorkflows The workflow registrations from extensions
 * @param name The name of the workflow
 * @returns The workflow
 * @throws Error if the workflow is not found
 */
export function getWorkflow(
  config: Config,
  extensionWorkflows: WorkflowRegistration[],
  name: string,
): Workflow {
  // First ensure all workflows are registered
  validateWorkflows(config, extensionWorkflows);
  const workflow = workflowRegistry.get(name);
  if (!workflow) {
    throw new Error(`Workflow ${name} not found`);
  }
  return workflow;
}

/**
 * Get all registered workflows, ensuring they're all registered first
 * @param config The app configuration
 * @param extensionWorkflows The workflow registrations from extensions
 * @returns Record of all workflows by name
 */
export function getWorkflows(
  config: Config,
  extensionWorkflows: WorkflowRegistration[],
): Record<string, Workflow> {
  // First ensure all workflows are registered
  validateWorkflows(config, extensionWorkflows);
  return Object.fromEntries(workflowRegistry);
}

/**
 * Get all registered workflow names, ensuring they're all registered first
 * @param config The app configuration
 * @param extensionWorkflows The workflow registrations from extensions
 * @returns Array of workflow names
 */
export function getWorkflowNames(
  config: Config,
  extensionWorkflows: WorkflowRegistration[],
): string[] {
  // First ensure all workflows are registered
  validateWorkflows(config, extensionWorkflows);
  return Array.from(workflowRegistry.keys());
}

/**
 * Validate that all expected workflows are registered, registering any that aren't
 * @param config The app configuration
 * @param extensionWorkflows The workflow registrations from extensions
 * @param extensions Optional extensions array for better missing extension detection
 * @returns Array of missing workflow/extension names
 */
export function validateWorkflows(
  config: Config,
  extensionWorkflows: WorkflowRegistration[],
  extensions?: ClientExtension[],
): string[] {
  const missing: string[] = [];

  // Ensure core workflows are registered
  ensureCoreWorkflowsRegistered();

  // Register workflows from the provided extension workflow registrations
  for (const registration of extensionWorkflows) {
    for (const workflow of registration.workflows) {
      if (!workflowRegistry.has(workflow.name)) {
        registerWorkflow(workflow.name, workflow);
      }
    }
  }

  // Check if any enabled extensions from config are missing their workflows
  // This can happen if:
  // 1. An extension is configured but not loaded/registered
  // 2. An extension is configured but doesn't provide workflows (shouldn't happen if workflows: true in config)
  const enabledExtensions = getEnabledExtensionWorkflowNames(config);

  if (extensions) {
    // We have access to extensions, so we can do a proper check for missing ones
    for (const extensionName of enabledExtensions) {
      const extensionWorkflow = getExtensionWorkflows(extensions, extensionName);
      if (!extensionWorkflow) {
        missing.push(extensionName);
      }
    }
  }
  // When extensions array is not provided (e.g., called from within an extension),
  // we skip missing extension detection. The main app will perform full validation.

  return missing;
}

/**
 * Clear all registered workflows
 * Note: This is mainly for testing purposes
 */
export function clearWorkflows(): void {
  workflowRegistry.clear();
  coreWorkflowsRegistered = false;
}
