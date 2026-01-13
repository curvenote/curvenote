import { Form, useFetcher } from 'react-router';
import { useEffect } from 'react';
import type { ActionResponse } from './types';
import { ui } from '@curvenote/scms-core';

export function SignupCompletionForm({ disabled = false }: { disabled?: boolean }) {
  const fetcher = useFetcher<ActionResponse>();

  // Handle error responses
  useEffect(() => {
    console.log('fetcher.data', fetcher.data);
    if (fetcher.data?.error) {
      ui.toastError(fetcher.data.error.message);
    }
  }, [fetcher.data]);

  return (
    <div className="border-t border-stone-300">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="complete-signup" />
        <div className="flex justify-between px-8 py-6">
          <Form action="/logout" method="POST" className="flex justify-center">
            <ui.Button variant="link" type="submit">
              Logout
            </ui.Button>
          </Form>
          <div className="flex justify-end">
            <ui.StatefulButton
              type="submit"
              name="intent"
              value="complete-signup"
              busy={fetcher.state !== 'idle'}
              overlayBusy
              disabled={disabled}
            >
              Complete Signup
            </ui.StatefulButton>
          </div>
        </div>
      </fetcher.Form>
    </div>
  );
}
