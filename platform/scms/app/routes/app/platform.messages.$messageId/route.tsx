import type { Route } from './+types/route';
import { data as dataResponse, Link } from 'react-router';
import { useState } from 'react';
import { PageFrame, ui, primitives, formatDatetime } from '@curvenote/scms-core';
import { withAppPlatformAdminContext, dbGetMessage } from '@curvenote/scms-server';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
        className="flex items-center w-full gap-2 text-left"
      >
        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        <h3 className="text-lg font-semibold">{title}</h3>
      </button>

      {isExpanded && (
        <div className="mt-4">
          <pre className="p-4 overflow-auto text-sm rounded-md bg-gray-50 dark:bg-gray-800">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </primitives.Card>
  );
}

export default function MessageDetailPage({ loaderData }: Route.ComponentProps) {
  const { message } = loaderData;
  // TODO type this as it is standard for email payloads
  const payload = message.payload;

  const breadcrumbs = [
    { label: 'Platform Messages', href: '/app/platform/messages' },
    { label: message.id, isCurrentPage: true },
  ];
  const date = payload.headers?.date ?? payload.envelope?.date ?? payload.date;

  return (
    <PageFrame
      title="Message Details"
      description={`Details for message ${message.id}`}
      className="max-w-screen-lg mx-auto"
      breadcrumbs={breadcrumbs}
    >
      <div className="space-y-6">
        {/* Message Overview */}
        <primitives.Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {payload.headers?.subject ?? payload.subject ?? message.id}
              </h2>
              <div>
                from: {payload.headers?.from ?? payload.envelope?.from ?? payload.from ?? 'Unknown'}
              </div>
              {date && <div>date: {date}</div>}
              <div className="flex gap-2 mt-2">
                <ui.Badge variant="outline">{message.module}</ui.Badge>
                <ui.Badge variant="outline">{message.type}</ui.Badge>
                <ui.Badge variant={getStatusVariant(message.status)}>{message.status}</ui.Badge>
              </div>
            </div>
            <div className="text-sm text-right text-gray-600 dark:text-gray-400">
              <div>
                <strong>Received:</strong> {formatDatetime(message.date_created)}
              </div>
              <div>
                <strong>Modified:</strong> {formatDatetime(message.date_modified)}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="my-2 -ml-2 text-xs font-medium">Message Body:</div>
            <div className="font-mono text-sm whitespace-pre-wrap">
              {payload.plain ?? 'No plain text body'}
            </div>
          </div>
        </primitives.Card>

        {/* Processing Results */}
        {message.results && (
          <JsonDisplay title="Processing Results" data={message.results} defaultExpanded={true} />
        )}

        {/* Raw Payload */}
        <JsonDisplay title="Raw Payload" data={message.payload} />

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
