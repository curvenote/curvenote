import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { primitives, ui } from '@curvenote/scms-core';
import { FormArea } from './form.js';

type SuccessStepProps = {
  stepNumber: number;
  workId: string | null;
  isLoggedIn: boolean;
};

export function SuccessStep({ stepNumber, workId, isLoggedIn }: SuccessStepProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const workUrl = workId ? `/app/works/${workId}` : null;

  useEffect(() => {
    if (isLoggedIn && workUrl && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, isLoggedIn, workUrl]);

  useEffect(() => {
    if (isLoggedIn && workUrl && countdown === 0) {
      navigate(workUrl);
    }
  }, [countdown, isLoggedIn, workUrl, navigate]);

  return (
    <FormArea stepNumber={stepNumber} stepTitle="Submission successful">
      <primitives.Card className="p-8 text-center border-0 shadow-none bg-transparent">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full dark:bg-green-900">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>

          <div>
            <h2 className="mb-2 text-2xl font-semibold">Thank you for your submission!</h2>
            <p className="text-stone-600 dark:text-stone-400">
              Your submission has been successfully received and is being processed.
            </p>
          </div>

          {isLoggedIn && workUrl ? (
            <div className="flex flex-col items-center w-full gap-4">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {countdown > 0
                  ? `Redirecting to your work in ${countdown} second${countdown !== 1 ? 's' : ''}...`
                  : 'Redirecting...'}
              </p>
              <ui.Button variant="default" onClick={() => navigate(workUrl)} className="gap-2">
                Go to Work Now
                <ArrowRight className="w-4 h-4" />
              </ui.Button>
            </div>
          ) : (
            <div className="p-4 text-sm text-center text-blue-800 rounded bg-blue-50 dark:bg-blue-900/20 dark:text-blue-200">
              <p className="font-medium">Next Steps</p>
              <p className="mt-2">
                Please check your email for further instructions and updates about your submission.
              </p>
            </div>
          )}
        </div>
      </primitives.Card>
    </FormArea>
  );
}
