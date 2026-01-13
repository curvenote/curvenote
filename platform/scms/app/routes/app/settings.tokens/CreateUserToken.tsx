import { useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import { useCallback, useRef, useState } from 'react';
import { Check } from 'lucide-react';

type TokenResponse =
  | { error: string }
  | {
      token: string;
      id: string;
      description: string;
      date_created: string;
      date_expires: string | null;
      last_used: string | null;
      expired: boolean;
    };

function isSuccessResponse(data: TokenResponse): data is Extract<TokenResponse, { token: string }> {
  return 'token' in data;
}

export function CreateUserToken({
  done,
  setDone,
}: {
  done: boolean;
  setDone: (d: boolean) => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const fetcher = useFetcher<TokenResponse>();

  const copyToClipboard = useCallback(() => {
    if (!fetcher.data || !isSuccessResponse(fetcher.data)) return;
    navigator.clipboard
      .writeText(fetcher.data.token)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch((err) => console.error('Failed to copy text to clipboard: ', err));
  }, [fetcher.data]);

  const handleSelectText = useCallback(() => {
    if (preRef.current) {
      const range = document.createRange();
      range.selectNodeContents(preRef.current); // Select all contents of the <pre> tag
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges(); // Clear any existing selection
        selection.addRange(range); // Add the new range
      }
    }
  }, [preRef]);

  return (
    <primitives.Card lift>
      <div className="py-4 space-y-6">
        <fetcher.Form ref={ref} method="POST" className="space-y-4" onSubmit={() => setDone(false)}>
          <h2>Create a new token</h2>
          <input type="hidden" name="formAction" value="create" />
          <div className="flex items-center space-x-4">
            <div className="grow max-w-[300px]">
              <primitives.TextField
                id="token.description"
                name="description"
                label=""
                placeholder="Token description"
                disabled={fetcher.state === 'submitting'}
                required
              />
            </div>
            <div className="flex-none">
              <select
                className="bg-slate-50 dark:bg-slate-800"
                id="token.expiry"
                name="expiry"
                defaultValue="NEVER"
                disabled={fetcher.state === 'submitting'}
              >
                <option value="NEVER">Never expires</option>
                <option value="NINETY_DAYS">90 days</option>
                <option value="SIXTY_DAYS">60 days</option>
                <option value="THIRTY_DAYS">30 days</option>
                <option value="SEVEN_DAYS">7 days</option>
                <option value="ONE_DAY">1 day</option>
                <option value="FIVE_MINUTES">5 minutes</option>
              </select>
            </div>
            <div className="flex-none">
              <ui.StatefulButton
                className="disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none"
                type="submit"
                busy={fetcher.state === 'submitting'}
                busyMessage="Creating..."
              >
                Create
              </ui.StatefulButton>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            The description may be shown where the token is used. Do not include sensitive
            information.
          </div>
        </fetcher.Form>
        {fetcher.state === 'idle' && fetcher.data && !isSuccessResponse(fetcher.data) && (
          <primitives.Card className="py-4 text-red-900 bg-red-100 border border-red-600 dark:bg-red-950 dark:text-red-200">
            Error: {fetcher.data.error}
          </primitives.Card>
        )}
        {!done && fetcher.state === 'idle' && fetcher.data && isSuccessResponse(fetcher.data) && (
          <primitives.Card className="py-4 space-y-4 text-green-900 bg-green-100 border border-green-600 dark:bg-green-950 dark:text-green-200">
            <h3 className="font-bold">Copy Token Now</h3>
            <p className="mb-6 text-green-900 dark:text-green-200">
              Make sure to <strong>copy</strong> your <strong>"{fetcher.data.description}"</strong>{' '}
              personal access token now. You won't be able to see it again.
            </p>
            <pre
              className="p-4 font-mono break-words border border-green-900 dark:border-green-100 text-wrap"
              ref={preRef}
              onClick={handleSelectText}
            >
              {fetcher.data.token}
            </pre>
            <div className="flex justify-end gap-2">
              <ui.Button
                variant="outline"
                type="button"
                onClick={() => {
                  ref.current?.reset();
                  setDone(true);
                }}
              >
                Done
              </ui.Button>
              <ui.Button type="button" onClick={copyToClipboard}>
                {copied ? (
                  <span className="flex items-center">
                    <Check className="inline-block w-6 h-6 mr-1" />
                    Copied!
                  </span>
                ) : (
                  'Copy'
                )}
              </ui.Button>
            </div>
          </primitives.Card>
        )}
      </div>
    </primitives.Card>
  );
}
