import type { Route } from './+types/route';
import { useFetcher, Link, data } from 'react-router';
import { useState, useEffect } from 'react';
import { ui, primitives, getFetcherField } from '@curvenote/scms-core';
import { unsubscribe } from '@curvenote/scms-server';
import { CheckCircle, XCircle, Mail } from 'lucide-react';
import { CurvenoteText } from '@curvenote/icons';

export async function action(args: Route.ActionArgs) {
  const url = new URL(args.request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return data({ error: 'Missing unsubscribe token' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await args.request.formData();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return data({ error: 'Invalid request format' }, { status: 400 });
  }

  // Check for RFC 8058 compliance - email clients send List-Unsubscribe in form data
  // The List-Unsubscribe-Post header tells email clients what key/value to send
  const listUnsubscribe = formData.get('List-Unsubscribe');
  if (listUnsubscribe === 'One-Click') {
    // RFC 8058 compliant request from email client
    try {
      await unsubscribe.dbToggleUnsubscribeWithToken(token, true);
      return { success: true, message: 'Successfully unsubscribed' };
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return data({ error: 'Failed to unsubscribe' }, { status: 400 });
    }
  }

  // Frontend form submission
  const intent = formData.get('intent');
  if (intent === 'unsubscribe') {
    try {
      await unsubscribe.dbToggleUnsubscribeWithToken(token, true);
      return {
        success: true,
        message: 'Successfully unsubscribed from notification emails',
      };
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return data({ error: 'Failed to unsubscribe' }, { status: 400 });
    }
  }
  if (intent === 'resubscribe') {
    try {
      await unsubscribe.dbToggleUnsubscribeWithToken(token, false);
      return {
        success: true,
        message: 'Successfully resubscribed to notification emails',
      };
    } catch (error) {
      console.error('Resubscribe error:', error);
      return data({ error: 'Failed to resubscribe' }, { status: 400 });
    }
  }

  return data({ error: 'Invalid action' }, { status: 400 });
}

export default function UnsubscribePage() {
  const unsubscribeFetcher = useFetcher<typeof action>();
  const resubscribeFetcher = useFetcher<typeof action>();
  const isResubscribing = resubscribeFetcher.state === 'submitting';
  const [hasUnsubscribed, setHasUnsubscribed] = useState(false);
  const error = getFetcherField(unsubscribeFetcher.data, 'error');
  const resubscribeSuccess = getFetcherField(resubscribeFetcher.data, 'success');
  const resubscribeMessage = getFetcherField(resubscribeFetcher.data, 'message');
  const resubscribeError = getFetcherField(resubscribeFetcher.data, 'error');

  // Automatically unsubscribe on first load
  useEffect(() => {
    if (!hasUnsubscribed) {
      unsubscribeFetcher.submit({ intent: 'unsubscribe' }, { method: 'post' });
      setHasUnsubscribed(true);
    }
  }, [hasUnsubscribed, unsubscribeFetcher]);

  // Show error if unsubscribe failed
  if (error) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <primitives.Card className="p-6 text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Unsubscribe Failed</h1>
          <p className="mb-6 text-sm text-gray-500">
            Please check your email for a valid unsubscribe link or contact support.
          </p>

          <div className="mt-3">
            <Link
              to="/app/settings/emails"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Manage Email Preferences
            </Link>
          </div>
        </primitives.Card>

        <div className="mt-8 text-center">
          <a
            href="https://curvenote.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <CurvenoteText className="h-4" />
          </a>
        </div>
      </div>
    );
  }

  // Show main content
  return (
    <div className="max-w-md mx-auto mt-8">
      <primitives.Card className="p-6 text-center">
        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Unsubscribed Successfully</h1>
        <p className="mb-6 text-sm text-gray-500">
          You will still receive important account-related emails such as password resets.
        </p>

        <resubscribeFetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="resubscribe" />
          <ui.Button
            type="submit"
            disabled={isResubscribing || resubscribeSuccess}
            className={`w-full ${
              resubscribeSuccess
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Mail className="w-4 h-4 mr-2" />
            {isResubscribing
              ? 'Resubscribing...'
              : resubscribeSuccess
                ? 'Resubscribed Successfully'
                : 'Resubscribe to Notifications'}
          </ui.Button>
        </resubscribeFetcher.Form>

        {resubscribeSuccess && resubscribeMessage && (
          <div className="p-3 mt-4 border border-green-200 rounded-md bg-green-50">
            <p className="text-sm text-green-800">{resubscribeMessage}</p>
          </div>
        )}

        {resubscribeError && (
          <div className="p-3 mt-4 border border-red-200 rounded-md bg-red-50">
            <p className="text-sm text-red-800">{resubscribeError}</p>
          </div>
        )}

        <div className="mt-3">
          <Link
            to="/app/settings/emails"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Manage Email Preferences
          </Link>
        </div>
      </primitives.Card>

      <div className="mt-8 text-center">
        <a
          href="https://curvenote.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <CurvenoteText className="h-4" />
        </a>
      </div>
    </div>
  );
}
