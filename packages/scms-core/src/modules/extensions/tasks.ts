import type { ClientExtension, Task, TaskComponent } from './types.js';

export function getAvailableTasks(extensions: ClientExtension[]): Task[] {
  return extensions
    .flatMap((extension) => extension.getTasks?.() || [])
    .map((task) => ({ name: task.id }));
}

export function getAvailableTasksWithComponents(
  extensions: ClientExtension[],
): Array<Task & { component: TaskComponent }> {
  return extensions
    .flatMap((extension) => extension.getTasks?.() || [])
    .map((task) => ({ name: task.id, component: task.component }));
}
