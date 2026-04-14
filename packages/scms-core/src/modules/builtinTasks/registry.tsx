import type { ExtensionTask } from '../extensions/types.js';
import { AutomatedChecksTaskCard } from './AutomatedChecksTaskCard.js';
import { BUILTIN_TASK_IDS } from './ids.js';

const BUILTIN_TASKS_BY_ID: Record<string, ExtensionTask> = {
  [BUILTIN_TASK_IDS.automatedChecks]: {
    id: BUILTIN_TASK_IDS.automatedChecks,
    name: 'Check My Work',
    description: 'Upload a draft and get automatic checks on its words and figures for plagiarism.',
    component: AutomatedChecksTaskCard,
    category: 'check',
  },
};

export function getBuiltinTasksWithComponents(allowedIds: string[]): ExtensionTask[] {
  return allowedIds
    .map((id) => BUILTIN_TASKS_BY_ID[id])
    .filter((task): task is ExtensionTask => task != null);
}
