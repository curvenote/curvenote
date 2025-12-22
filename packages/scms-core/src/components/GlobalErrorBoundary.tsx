import { isRouteErrorResponse, useRouteError, useLocation } from 'react-router';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button.js';
import { CurvenoteText } from '@curvenote/icons';

// Reusable components
function ErrorHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 text-center">
      <div className="flex items-center justify-center mx-auto mb-4">
        <CurvenoteText />
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">{title}</h1>
      <p className="text-stone-600 dark:text-stone-400">{subtitle}</p>
    </div>
  );
}

function ErrorDetails({
  title,
  content,
  copyText,
  showStack = false,
  stackTrace,
  children,
}: {
  title: string;
  content: string;
  copyText: string;
  showStack?: boolean;
  stackTrace?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="p-4 mb-6 border rounded-lg bg-stone-50 dark:bg-stone-900/50 border-stone-200 dark:border-stone-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">{title}</h3>
        <button
          onClick={() => copyToClipboard(copyText)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 rounded transition-colors"
        >
          <Copy className="w-3 h-3" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="space-y-2">
        {content && <p className="text-sm font-medium text-red-600 dark:text-red-400">{content}</p>}
        {children}
        {showStack && stackTrace && (
          <details className="text-xs">
            <summary className="cursor-pointer text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200">
              Show stack trace
            </summary>
            <pre className="p-3 mt-2 overflow-auto font-mono text-xs rounded max-h-32 text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800">
              {stackTrace}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function SupportInfo({
  errorStatus,
  errorStatusText,
}: {
  errorStatus?: number;
  errorStatusText?: string;
}) {
  const getSubject = () => {
    if (errorStatus) {
      return `Error ${errorStatus}: ${errorStatusText || 'Something went wrong'}`;
    }
    return 'Error: Something went wrong';
  };

  const reload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const goBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <div className="text-center">
      <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        If this error keeps occurring, please{' '}
        <a
          href={`mailto:support@curvenote.com?subject=${encodeURIComponent(getSubject())}`}
          className="underline text-stone-800 dark:text-stone-200 hover:text-stone-600 dark:hover:text-stone-400"
        >
          contact our support team
        </a>
        .
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={reload} variant="default">
          Refresh Page
        </Button>
        <Button onClick={goBack} variant="secondary">
          Go Back
        </Button>
      </div>
    </div>
  );
}

function ErrorContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-stone-50 dark:bg-stone-900">
      <div className="w-full max-w-2xl p-8 bg-white border rounded-lg shadow-lg dark:bg-stone-800 border-stone-200 dark:border-stone-700">
        {children}
      </div>
    </div>
  );
}

// Main error boundary component
export function GlobalErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentUrl = `${origin}${location.pathname}${location.search}${location.hash}`;

  if (error instanceof Error) {
    return (
      <ErrorContainer>
        <ErrorHeader
          title="Something went wrong"
          subtitle="We're sorry, but something unexpected happened. Please try refreshing the page."
        />
        <ErrorDetails
          title="Error Details"
          content={error.message}
          copyText={`URL: ${currentUrl}\n\nError: ${error.message}\n\nStack Trace:\n${error.stack}`}
          showStack={true}
          stackTrace={error.stack}
        />
        <SupportInfo />
      </ErrorContainer>
    );
  }

  if (!isRouteErrorResponse(error)) {
    return (
      <ErrorContainer>
        <ErrorHeader
          title="Something went wrong"
          subtitle="We're sorry, but something unexpected happened. Please try refreshing the page."
        />
        <SupportInfo />
      </ErrorContainer>
    );
  }

  const data = (error as any).data;
  let body: { type?: string; reason?: string; message?: string; [key: string]: any } = {};
  if (data) {
    try {
      body = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      // If data is not valid JSON, treat it as a plain error message
      body = { message: data };
    }
  }

  return (
    <ErrorContainer>
      <ErrorHeader
        title={`Error ${error.status}`}
        subtitle={error.statusText || 'Something went wrong'}
      />
      {(body?.type || body?.reason) && (
        <ErrorDetails
          title="Error Details"
          content=""
          copyText={JSON.stringify(
            { url: currentUrl, status: error.status, statusText: error.statusText, ...body },
            null,
            2,
          )}
        >
          <div className="space-y-2 text-sm">
            {body?.type && (
              <p className="text-stone-700 dark:text-stone-300">
                <span className="font-medium">Type:</span> {body.type}
              </p>
            )}
            {body?.reason && (
              <p className="text-stone-700 dark:text-stone-300">
                <span className="font-medium">Reason:</span> {body.reason}
              </p>
            )}
          </div>
        </ErrorDetails>
      )}
      <SupportInfo errorStatus={error.status} errorStatusText={error.statusText} />
    </ErrorContainer>
  );
}
