import { useFetcher, useLoaderData } from 'react-router';
import { useEffect, useState, useRef } from 'react';
import type { ActionResponse, LoaderData } from './types';
import { TaskListStep } from './TaskListStep';
import { ui, cn } from '@curvenote/scms-core';
import type { AgreementURL } from '@/types/app-config';
import type { SignupData, SignupStepData, UserData } from '@curvenote/scms-core';

export function AgreementStep({
  title,
  urls,
  open,
  setOpen,
}: {
  title?: string;
  urls?: AgreementURL[];
  open?: boolean;
  setOpen?: (open: boolean) => void;
}) {
  const { user } = useLoaderData() as LoaderData;
  const fetcher = useFetcher<ActionResponse>({ key: 'agreement' });
  const formRef = useRef<HTMLFormElement>(null);

  const userData = user.data as UserData;
  const signupData = userData?.signup as SignupData;
  const stepData = signupData?.steps?.['agreement'] as SignupStepData;
  const completed = stepData?.completed && stepData.type === 'agreement' && stepData.accepted;

  const [checked, setChecked] = useState(completed);

  // Handle fetcher errors and responses
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error.message);
        // Reset optimistic state on error
        setChecked(completed);
      }
    }
  }, [fetcher.data, completed]);

  // Handle fetcher state errors (network errors, etc.)
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined && fetcher.formMethod) {
      // This indicates a submission that didn't return data, likely a network error
      ui.toastError('Network error occurred. Please try again.');
      setChecked(completed);
    }
  }, [fetcher.state, fetcher.data, fetcher.formMethod, completed]);

  return (
    <TaskListStep
      completed={completed}
      title={title ?? 'Agree to Terms of Service'}
      open={open}
      setOpen={setOpen}
    >
      <fetcher.Form method="post" ref={formRef}>
        <input type="hidden" name="intent" value="complete-agreement" />
        <input type="hidden" name="agreedToTerms" value={checked ? 'true' : 'false'} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <ui.Checkbox
              id="terms-checkbox"
              defaultChecked={checked}
              disabled={fetcher.state !== 'idle'}
              onCheckedChange={(value) => {
                setChecked(!!value);
                if (formRef.current) {
                  formRef.current.requestSubmit();
                }
              }}
              className="mt-0.5"
            />
            <label
              htmlFor="terms-checkbox"
              className={cn('text-base cursor-pointer', { 'opacity-80': completed })}
            >
              I accept the{' '}
              {urls && urls.length > 0
                ? urls.map((url, index) => (
                    <span key={index}>
                      {index > 0 && index === urls.length - 1 && ' and '}
                      {index > 0 && index < urls.length - 1 && ', '}
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        {url.label}
                      </a>
                    </span>
                  ))
                : 'terms and conditions'}
            </label>
          </div>
        </div>
      </fetcher.Form>
    </TaskListStep>
  );
}
