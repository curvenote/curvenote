import { Check } from 'lucide-react';
import { Button } from '../ui/button.js';
import { cn } from '../../utils/cn.js';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  answeredSteps: number;
  isFirstQuestion?: boolean;
  onStartOver?: () => void;
  onFinish?: () => void;
  renderAdditionalControls?: (isCompleted: boolean, isFirstQuestion: boolean) => React.ReactNode;
  className?: string;
}

export function WizardProgress({
  currentStep,
  totalSteps,
  answeredSteps,
  isFirstQuestion = false,
  onStartOver,
  onFinish,
  renderAdditionalControls = () => null,
  className,
}: WizardProgressProps) {
  const isCompleted = answeredSteps === totalSteps;
  return (
    <div data-name="wizard-progress" className={cn('space-y-3', className)}>
      {/* Progress bar with stops */}
      <div className="relative w-1/2">
        {/* Background line */}
        <div className="absolute top-2 left-0 right-0 h-0.5 bg-gray-200" />

        {/* Progress line */}
        <div
          className="absolute top-2 left-0 h-0.5 bg-blue-500 transition-all duration-300"
          style={{
            width:
              currentStep === 1
                ? '0%'
                : totalSteps === 1
                  ? '100%'
                  : answeredSteps === totalSteps
                    ? '100%'
                    : `${Math.min(((currentStep - 1) / (totalSteps - 1)) * 100, 100)}%`,
          }}
        />

        {/* Stops */}
        <div className="relative flex justify-between">
          {Array.from({ length: totalSteps }, (_, index) => {
            const stepNumber = index + 1;
            const isCompletedStep = stepNumber <= answeredSteps;
            const isCurrent = stepNumber === currentStep;

            return (
              <div key={stepNumber} className="flex flex-col items-center">
                {/* Stop circle */}
                <div
                  className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300
                    ${
                      isCompletedStep
                        ? 'text-white bg-blue-500 border-blue-500'
                        : isCurrent
                          ? 'text-blue-500 bg-white border-blue-500'
                          : 'text-gray-400 bg-white border-gray-300'
                    }
                  `}
                >
                  {isCompletedStep ? (
                    <Check className="w-2 h-2" />
                  ) : (
                    <span className="text-xs font-medium"></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress text */}
      <div
        data-name="wizard-progress-text"
        className="flex flex-row items-center justify-between h-6 gap-2 text-left"
      >
        <div className="text-sm text-blue-600">
          Step {Math.min(currentStep, totalSteps)} of {totalSteps} • {answeredSteps} completed
        </div>
        <div data-name="wizard-progress-buttons" className="flex flex-row gap-4">
          {onFinish && isCompleted && (
            <Button variant="link" onClick={onFinish}>
              Finish
            </Button>
          )}
          {onStartOver && !isFirstQuestion && (
            <Button variant="link" onClick={onStartOver}>
              Start Over
            </Button>
          )}
          {renderAdditionalControls(isCompleted, isFirstQuestion)}
        </div>
      </div>
    </div>
  );
}
