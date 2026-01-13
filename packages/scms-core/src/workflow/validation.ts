import type { Workflow, WorkflowState, WorkflowTransition } from './types.js';

/**
 * Validate a workflow state
 * @param state The state to validate
 * @returns Array of validation errors, empty if valid
 */
function validateState(state: WorkflowState): string[] {
  const errors: string[] = [];

  if (!state.name) errors.push('State must have a name');
  if (!state.label) errors.push('State must have a label');
  if (typeof state.authorOnly !== 'boolean') errors.push('State must have authorOnly boolean');
  if (typeof state.inbox !== 'boolean') errors.push('State must have inbox boolean');
  if (typeof state.visible !== 'boolean') errors.push('State must have visible boolean');
  if (typeof state.published !== 'boolean') errors.push('State must have published boolean');

  return errors;
}

/**
 * Validate a workflow transition
 * @param transition The transition to validate
 * @returns Array of validation errors, empty if valid
 */
function validateTransition(transition: WorkflowTransition): string[] {
  const errors: string[] = [];

  if (!transition.name) errors.push('Transition must have a name');
  if (transition.sourceStateName === undefined)
    errors.push('Transition must have a source state (can be null for any-state transitions)');
  if (!transition.targetStateName) errors.push('Transition must have a target state');
  if (!transition.labels) errors.push('Transition must have labels');
  if (typeof transition.userTriggered !== 'boolean')
    errors.push('Transition must have userTriggered boolean');
  if (!transition.help) errors.push('Transition must have help text');
  if (!Array.isArray(transition.requiredScopes))
    errors.push('Transition must have requiredScopes array');
  if (typeof transition.requiresJob !== 'boolean')
    errors.push('Transition must have requiresJob boolean');

  return errors;
}

/**
 * Validate a workflow
 * @param workflow The workflow to validate
 * @returns Array of validation errors, empty if valid
 */
export function validateWorkflow(workflow: Workflow): string[] {
  const errors: string[] = [];

  if (!workflow.name) errors.push('Workflow must have a name');
  if (!workflow.label) errors.push('Workflow must have a label');
  if (!workflow.initialState) errors.push('Workflow must have an initial state');
  if (!workflow.states) errors.push('Workflow must have states');
  if (!Array.isArray(workflow.transitions)) errors.push('Workflow must have transitions array');

  // Validate states
  if (workflow.states) {
    Object.entries(workflow.states).forEach(([name, state]) => {
      const stateErrors = validateState(state);
      errors.push(...stateErrors.map((err) => `State ${name}: ${err}`));
    });
  }

  // Validate transitions
  if (workflow.transitions) {
    workflow.transitions.forEach((transition, index) => {
      const transitionErrors = validateTransition(transition);
      errors.push(...transitionErrors.map((err) => `Transition ${index}: ${err}`));
    });
  }

  // Validate initial state exists
  if (workflow.initialState && workflow.states && !workflow.states[workflow.initialState]) {
    errors.push(`Initial state ${workflow.initialState} does not exist in states`);
  }

  return errors;
}
