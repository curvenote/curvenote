import { TaskListStep } from './TaskListStep';

export function PrimaryProviderStep({ title }: { title?: string }) {
  return (
    <TaskListStep
      completed
      disabled
      title={title ?? 'Signed in with primary provider'}
      open={false}
      setOpen={() => {}}
    ></TaskListStep>
  );
}
