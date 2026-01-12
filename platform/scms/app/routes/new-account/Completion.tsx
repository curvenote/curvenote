import { useFetcher } from 'react-router';
import type { ActionResponse } from './types';

export function CompletionComponent() {
  const fetcher = useFetcher<ActionResponse>();
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center items-center mx-auto w-16 h-16 bg-green-100 rounded-full dark:bg-green-900/20">
        <svg
          className="w-8 h-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-medium">Ready to Complete</h2>
      <p className="text-stone-600 dark:text-stone-400">
        You've completed all the required steps. Click below to finish your account setup.
      </p>

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="complete-signup" />
        <button
          type="submit"
          disabled={fetcher.state !== 'idle'}
          className="px-6 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {fetcher.state !== 'idle' ? 'Completing...' : 'Complete Account Setup'}
        </button>
      </fetcher.Form>
    </div>
  );
}
