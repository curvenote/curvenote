import type { Route } from './+types/route';
import { data as dataResponse, Link } from 'react-router';
import { useState } from 'react';
import { PageFrame, ui, primitives, formatDatetime } from '@curvenote/scms-core';
import { withAppPlatformAdminContext, dbGetMessage } from '@curvenote/scms-server';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { extractMessageEmailData } from '../platform.messages/message-utils';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Message Details' },
    { name: 'description', content: 'System administration - Message details' },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const messageId = args.params.messageId;
  if (!messageId) {
    throw dataResponse('Message ID required', { status: 400 });
  }

  const message = await dbGetMessage(ctx, messageId);
  if (!message) {
    throw dataResponse('Message not found', { status: 404 });
  }

  return { message };
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return 'default';
    case 'ERROR':
      return 'destructive';
    case 'PENDING':
      return 'secondary';
    case 'PARTIAL':
      return 'outline';
    case 'IGNORED':
      return 'outline';
    default:
      return 'secondary';
  }
}

interface JsonDisplayProps {
  title: string;
  data: any;
  defaultExpanded?: boolean;
}

function JsonDisplay({ title, data, defaultExpanded = false }: JsonDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!data) {
    return (
      <primitives.Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-500">{title}</h3>
        <p className="italic text-gray-400">No data</p>
      </primitives.Card>
    );
  }

  return (
    <primitives.Card className="p-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex gap-2 items-center w-full text-left"
      >
        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        <h3 className="text-lg font-semibold">{title}</h3>
      </button>

      {isExpanded && (
        <div className="mt-4">
          <pre className="overflow-auto p-4 text-sm bg-gray-50 rounded-md dark:bg-gray-800">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </primitives.Card>
  );
}

export default function MessageDetailPage({ loaderData }: Route.ComponentProps) {
  const { message } = loaderData;
  const payload = message.payload as any;
  const results = message.results as any;
  const hasPayloadSchema = payload?.$schema;
  const hasResultsSchema = results?.$schema;

  // Extract email data using shared utility
  const { subject, from, to, date, body } = extractMessageEmailData(message, {
    fallbackTo: 'Unknown',
    fallbackDate: 'Unknown',
    fallbackBody: 'Unknown',
  });

  const breadcrumbs = [
    { label: 'Platform Messages', href: '/app/platform/messages' },
    { label: message.id, isCurrentPage: true },
  ];

  return (
    <PageFrame
      title="Message Details"
      description={`Details for message ${message.id}`}
      className="mx-auto max-w-screen-lg"
      breadcrumbs={breadcrumbs}
    >
      <div className="space-y-6">
        {/* Message Overview */}
        <primitives.Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{subject}</h2>
              <div>
                {message.type === 'outbound_email' ? 'To' : 'From'}: {from}
                {to && message.type === 'outbound_email' && ` → ${to}`}
              </div>
              {date && (
                <div>
                  {message.type === 'outbound_email' ? 'Sent' : 'Received'}: {formatDatetime(date)}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <ui.Badge variant="outline">{message.module}</ui.Badge>
                <ui.Badge variant="outline">{message.type}</ui.Badge>
                <ui.Badge variant={getStatusVariant(message.status)}>{message.status}</ui.Badge>
              </div>
            </div>
            <div className="text-sm text-right text-gray-600 dark:text-gray-400">
              <div>
                <strong>{message.type === 'outbound_email' ? 'Created' : 'Received'}:</strong>{' '}
                {formatDatetime(message.date_created)}
              </div>
              <div>
                <strong>Modified:</strong> {formatDatetime(message.date_modified)}
              </div>
            </div>
          </div>
          {body && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <div className="my-2 -ml-2 text-xs font-medium">Message Body:</div>
              <div className="font-mono text-sm whitespace-pre-wrap">{body}</div>
            </div>
          )}
        </primitives.Card>

        {/* Structured Results (if schema exists) */}
        {hasResultsSchema && results && (
          <JsonDisplay
            title="Structured Results (with schema)"
            data={results}
            defaultExpanded={true}
          />
        )}

        {/* Processing Results (for backward compatibility with existing messages without schema) */}
        {message.results && !hasResultsSchema && (
          <JsonDisplay title="Processing Results" data={message.results} defaultExpanded={false} />
        )}

        {/* Structured Payload (if schema exists) */}
        {hasPayloadSchema && payload && (
          <JsonDisplay
            title="Structured Payload (with schema)"
            data={payload}
            defaultExpanded={false}
          />
        )}

        {/* Raw Payload (for backward compatibility or when no schema) */}
        {(!hasPayloadSchema || !hasResultsSchema) && (
          <JsonDisplay title="Raw Payload" data={message.payload} />
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <ui.Button variant="outline">
            <Link to="/app/platform/messages">Back to Messages</Link>
          </ui.Button>
        </div>
      </div>
    </PageFrame>
  );
}
