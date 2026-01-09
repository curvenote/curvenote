import { useFetcher, useLoaderData } from 'react-router';
import { useEffect } from 'react';
import type { ActionResponse, LoaderData } from './types';
import { TaskListStep } from './TaskListStep';
import { ui, cn } from '@curvenote/scms-core';
import type { DataCollectionStepData, UserData } from '@curvenote/scms-core';

export function DataCollectionStep({
  title,
  open,
  setOpen,
}: {
  title?: string;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}) {
  const { user } = useLoaderData() as LoaderData;
  const fetcher = useFetcher<ActionResponse>();

  const userData = (user.data ?? {}) as UserData;
  const signupData = userData.signup ?? {};
  const stepData = signupData.steps?.['data-collection'] as DataCollectionStepData;
  const completed = stepData?.completed ?? false;
  const displayName = stepData?.displayName ?? user.display_name ?? '';
  const email = stepData?.email ?? user.email ?? '';

  // Handle fetcher errors and responses
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error.message);
      }
    }
  }, [fetcher.data]);

  // Handle fetcher state errors (network errors, etc.)
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined && fetcher.formMethod) {
      // This indicates a submission that didn't return data, likely a network error
      ui.toastError('Network error occurred. Please try again.');
    }
  }, [fetcher.state, fetcher.data, fetcher.formMethod]);

  return (
    <TaskListStep
      completed={completed}
      title={title ?? 'Confirm account details'}
      open={open}
      setOpen={setOpen}
    >
      <fetcher.Form method="post" className="w-full" autoComplete="off">
        <div
          className={cn('p-4 space-y-4', {
            'opacity-50': completed,
          })}
        >
          {!completed ? (
            <>
              <input type="hidden" name="intent" value="complete-data-collection" />
            </>
          ) : (
            <>
              <input type="hidden" name="intent" value="revert-data-collection" />
            </>
          )}
          <input type="hidden" name="intent" value="complete-data-collection" />
          <div>Do these details look correct?</div>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              required
              defaultValue={displayName}
              disabled={completed}
              data-lpignore="true"
              className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              defaultValue={email}
              disabled={completed}
              data-lpignore="true"
              className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          {!completed ? (
            <>
              <ui.StatefulButton
                type="submit"
                busy={fetcher.state !== 'idle'}
                overlayBusy
                disabled={completed}
              >
                Looks good
              </ui.StatefulButton>
              <ui.Button className="font-normal" type="reset" variant="link" disabled={completed}>
                Reset
              </ui.Button>
            </>
          ) : (
            <>
              <ui.Button type="submit" variant="link" disabled={fetcher.state !== 'idle'}>
                Edit
              </ui.Button>
            </>
          )}
        </div>
      </fetcher.Form>
    </TaskListStep>
  );
}
