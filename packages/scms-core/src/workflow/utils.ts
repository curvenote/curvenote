import type { Workflow, WorkflowState, WorkflowTransition } from './types.js';

export function makeIsolatedState(name: string): WorkflowState {
  return {
    name,
    label: `${name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' ').toLowerCase()}...`,
    visible: false,
    published: false,
    authorOnly: false,
    inbox: false,
    tags: [],
  };
}

export function resolveEditorialWorkflow(workflow: string, isPrivate: boolean) {
  if (isPrivate) {
    return 'PRIVATE';
  }
  switch (workflow) {
    case 'OPEN_REVIEW':
      return 'OPEN_REVIEW';
    case 'CLOSED_REVIEW':
      return 'CLOSED_REVIEW';
    case 'SIMPLE':
    default:
      return 'SIMPLE';
  }
}

export function getWorkflowState(workflow: Workflow, status: string): WorkflowState | undefined {
  return workflow.states[status];
}

export function isPublished(workflow: Workflow, status: string): boolean {
  return workflow.states[status]?.published ?? false;
}

export function isVisible(workflow: Workflow, status: string): boolean {
  return workflow.states[status]?.visible ?? false;
}

export function getAllTransitionsWithSourceState(
  workflow: Workflow,
  stateName: string,
): WorkflowTransition[] {
  return workflow.transitions.filter((t) => t.sourceStateName === stateName);
}

export function getAllTransitionsWithTargetState(
  workflow: Workflow,
  stateName: string,
): WorkflowTransition[] {
  return workflow.transitions.filter((t) => t.targetStateName === stateName);
}

export function canTransitionTo(workflow: Workflow, fromStatus: string, toStatus: string): boolean {
  return workflow.transitions.some(
    (t) =>
      (t.sourceStateName === fromStatus || t.sourceStateName === null) &&
      t.targetStateName === toStatus,
  );
}

export function getValidTransition(
  workflow: Workflow,
  fromStatus: string,
  toStatus: string,
): WorkflowTransition | undefined {
  const transition = workflow.transitions.find(
    (t) =>
      (t.sourceStateName === fromStatus || t.sourceStateName === null) &&
      t.targetStateName === toStatus,
  );
  return transition;
}

export function getTargetState(workflow: Workflow, transition: WorkflowTransition): WorkflowState {
  return workflow.states[transition.targetStateName];
}

export function getAllTargetStates(workflow: Workflow, stateName: string): WorkflowState[] {
  return workflow.transitions
    .filter((t) => t.sourceStateName === stateName || t.sourceStateName === null)
    .map((t) => workflow.states[t.targetStateName]);
}

export function requiresJob(transition: WorkflowTransition): boolean {
  return transition.requiresJob === true;
}

export function getJobType(transition: WorkflowTransition): string | undefined {
  return transition.options?.jobType;
}
