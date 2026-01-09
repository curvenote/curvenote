import { cn } from '@curvenote/scms-core';

type ProgressState = 'default' | 'error' | 'success';

interface SegmentedProgressBarProps {
  /**
   * Current progress (0 to numSteps)
   */
  progress: number;
  /**
   * Total number of steps/segments
   */
  numSteps: number;
  /**
   * Visual state of the progress bar
   */
  state?: ProgressState;
  /**
   * Optional className for additional styling
   */
  className?: string;
}

const stateColors: Record<ProgressState, { filled: string; empty: string }> = {
  default: {
    filled: 'bg-primary',
    empty: 'bg-gray-200 dark:bg-gray-700',
  },
  error: {
    filled: 'bg-red-500',
    empty: 'bg-gray-200 dark:bg-gray-700',
  },
  success: {
    filled: 'bg-green-500',
    empty: 'bg-gray-200 dark:bg-gray-700',
  },
};

export function SegmentedProgressBar({
  progress,
  numSteps,
  state = 'default',
  className,
}: SegmentedProgressBarProps) {
  // Ensure progress is within bounds
  const clampedProgress = Math.max(0, Math.min(progress, numSteps));

  const colors = stateColors[state];
  const completedColor = 'bg-green-500'; // Always use green for completed steps

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
      <div className={cn('flex gap-[3px]', className)}>
        {Array.from({ length: numSteps }, (_, index) => {
          const isCompleted = index < clampedProgress - 1; // Steps before current
          const isActive = index === clampedProgress - 1; // Current step
          const isEmpty = index >= clampedProgress; // Future steps

          // Determine segment color
          let segmentColor: string;
          if (isCompleted) {
            segmentColor = completedColor;
          } else if (isActive) {
            segmentColor = colors.filled;
          } else {
            segmentColor = colors.empty;
          }

          return (
            <div
              key={index}
              className={cn(
                'flex-1 h-2 transition-colors duration-1000 relative overflow-hidden',
                segmentColor,
              )}
              aria-label={`Step ${index + 1} of ${numSteps}${isCompleted ? ' - completed' : isActive ? ' - active' : ''}`}
            >
              {isActive && state === 'default' && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent via-white/50"
                  style={{
                    animation: 'shimmer 2s ease-in-out infinite',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
