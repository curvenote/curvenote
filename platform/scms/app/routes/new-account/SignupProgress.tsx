import { cn, useDeploymentConfig } from '@curvenote/scms-core';

export function SignupProgress({
  totalSteps,
  answeredSteps,
  className,
}: {
  totalSteps: number;
  answeredSteps: number;
  className?: string;
}) {
  const config = useDeploymentConfig();
  // Calculate progress percentage
  const progressPercentage = (answeredSteps / totalSteps) * 100;
  const isCompleted = answeredSteps === totalSteps;

  // Get the progress message from config, with fallback
  const progressMessage = config.signupConfig?.signup?.progressMessage;

  // Replace {platformName} placeholder with actual platform name
  const formattedMessage = progressMessage?.replace(
    '{platformName}',
    config.name || 'Curvenote SCMS',
  );

  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isCompleted ? 'bg-green-600' : 'bg-blue-400'
          }`}
          style={{ width: `${progressPercentage === 0 ? 5 : progressPercentage}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-left text-muted-foreground">
        {answeredSteps} of {totalSteps} steps completed
      </div>
      {formattedMessage && <p className="mt-2 text-muted-foreground">{formattedMessage}</p>}
    </div>
  );
}
