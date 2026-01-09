import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { redirect, useLoaderData, Form } from 'react-router';
import {
  useDeploymentConfig,
  getBrandingFromMetaMatches,
  joinPageTitle,
  ui,
} from '@curvenote/scms-core';
import { withContext } from '@curvenote/scms-server';

export const meta: MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Awaiting Approval', branding?.title) }];
};

export const loader = async (args: LoaderFunctionArgs) => {
  const ctx = await withContext(args);

  // Check if user is authenticated
  if (!ctx.user) {
    throw redirect('/login');
  }

  // Check if user is not pending (already approved) - redirect to app
  if (!ctx.user.pending) {
    throw redirect('/app');
  }

  // Check if user is pending but not ready for approval - redirect to new account
  if (ctx.user.pending && !ctx.user.ready_for_approval) {
    throw redirect('/new-account/pending');
  }

  // User is pending and ready for approval - show waiting page
  return {
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      displayName: ctx.user.display_name,
      signupData: (ctx.user.data as any)?.signup,
    },
  };
};

type LoaderData = {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    signupData: any;
  };
};

export default function AwaitingApproval() {
  const { user } = useLoaderData() as LoaderData;
  const { branding } = useDeploymentConfig();

  const signupCompletedAt = user.signupData?.completedAt;
  const completedDate = signupCompletedAt
    ? new Date(signupCompletedAt).toLocaleDateString()
    : 'recently';

  return (
    <div className="flex flex-col w-full max-w-lg mt-8">
      <div className="space-y-6 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-light text-stone-900 dark:text-stone-100">
            Awaiting Approval
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400">
            Your account signup is complete and awaiting approval.
          </p>
        </div>

        {/* Details Card */}
        <div className="p-6 space-y-4 text-left border rounded-lg bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                Signup Completed
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                {signupCompletedAt ? `Completed on ${completedDate}` : 'Completed recently'}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Under Review</p>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Your account will be reviewed by our team
              </p>
            </div>
          </div>
        </div>

        {/* Information Section */}
        <div className="space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">
              What happens next?
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Our administrators will review your account and approve access to the{' '}
              {branding?.title ?? 'platform'}. You'll receive an email notification once your
              account has been approved.
            </p>
          </div>

          <div className="pt-4 space-y-3">
            {branding?.supportEmail && (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Questions? Contact us at{' '}
                <a
                  href={`mailto:${branding?.supportEmail}`}
                  className="text-blue-600 underline dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  {branding?.supportEmail}
                </a>
              </p>
            )}
          </div>
        </div>
        {/* Logout Button */}
        <div className="sticky bottom-0 py-2 mb-0 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
          <Form action="/logout" method="POST" className="flex justify-center">
            <ui.Button variant="outline" size="sm" type="submit">
              Logout
            </ui.Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
