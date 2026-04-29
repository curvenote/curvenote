import { cn } from '../../utils/cn.js';

export type SegmentedProgressBarState = 'default' | 'error' | 'success';

export interface SegmentedProgressBarProps {
  /** Current progress (0 to numSteps). */
  progress: number;
  /** Total number of steps/segments. */
  numSteps: number;
  /** Visual state of the progress bar. */
  state?: SegmentedProgressBarState;
  /** Optional className for additional styling. */
  className?: string;
}

const stateColors: Record<SegmentedProgressBarState, { filled: string; empty: string }> = {
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
  const clampedProgress = Math.max(0, Math.min(progress, numSteps));

  const colors = stateColors[state];
  const completedColor = 'bg-green-500';

  return (
    <>
      <style>{`
        @keyframes segmented-progress-shimmer {
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
          const isCompleted = index < clampedProgress - 1;
          const isActive = index === clampedProgress - 1;
          const isEmpty = index >= clampedProgress;

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
                'overflow-hidden relative flex-1 h-2 transition-colors duration-1000',
                segmentColor,
              )}
              aria-label={`Step ${index + 1} of ${numSteps}${isCompleted ? ' - completed' : isActive ? ' - active' : ''}`}
            >
              {isActive && state === 'default' && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent via-white/50"
                  style={{
                    animation: 'segmented-progress-shimmer 2s ease-in-out infinite',
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
