import type { Route } from './+types/route';
import { Link } from 'react-router';
import {
  withAppPlatformAdminContext,
  dbGetMessages,
  dbGetMessageCounts,
} from '@curvenote/scms-server';
import { PageFrame, ui, formatDatetime } from '@curvenote/scms-core';
import { parseMessageQuery, buildMessageQuery, type MessageQuery } from './query-parser';
import type { Message } from '@prisma/client';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'System Messages' },
    { name: 'description', content: 'System administration - Message processing logs' },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args);
  const url = new URL(args.request.url);
  const qValue = url.searchParams.get('q') || '';

  let query: MessageQuery = {};
  if (qValue) {
    query = parseMessageQuery(qValue);
  }

  const [messages, counts] = await Promise.all([
    dbGetMessages(ctx, query),
    dbGetMessageCounts(ctx),
  ]);

  return {
    messages,
    counts,
    query,
  };
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

function truncatePayload(payload: any): string {
  if (!payload) return 'No payload';

  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return str.length > 100 ? `${str.substring(0, 100)}...` : str;
}

export default function SystemMessagesPage({ loaderData }: Route.ComponentProps) {
  const { messages, counts, query } = loaderData;

  const renderMessage = (message: Message) => {
    // TODO if an inbound_email message, which is all we have right now
    const payload = message.payload as any;
    const date = payload.headers?.date ?? payload.envelope?.date ?? payload.date;
    return (
      <>
        {/* Message Info */}
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <div className="flex flex-col gap-1">
            <div>
              <Link
                to={`/app/platform/messages/${message.id}`}
                className="flex-shrink-0 block text-lg font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {payload.headers?.subject ??
                  payload.envelope?.from ??
                  payload.subject ??
                  message.id}
              </Link>
            </div>
            <div>
              From: {payload.headers?.from ?? payload.envelope?.from ?? payload.from ?? 'Unknown'}
            </div>
            {date && <div>Date: {date}</div>}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div>Received: {formatDatetime(message.date_created)}</div>
            </div>
            <div className="flex flex-wrap gap-2 my-2">
              <ui.Badge variant="outline">{message.module}</ui.Badge>
              <ui.Badge variant="outline">{message.type}</ui.Badge>
              <ui.Badge variant={getStatusVariant(message.status)}>{message.status}</ui.Badge>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="mt-1 overflow-hidden font-mono text-xs">
              {truncatePayload(payload.plain ?? payload)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end flex-shrink-0 w-32">
          <Link to={`/app/platform/messages/${message.id}`}>
            <ui.Button variant="outline" size="sm" className="w-full">
              View Details
            </ui.Button>
          </Link>
        </div>
      </>
    );
  };

  // Build filter definitions with counts
  const moduleFilters: ui.FilterDefinition[] = Object.entries(counts.byModule).map(
    ([module, count]) => ({
      key: 'module',
      value: module,
      label: module,
      count: count as number,
    }),
  );

  const statusFilters: ui.FilterDefinition[] = Object.entries(counts.byStatus).map(
    ([status, count]) => ({
      key: 'status',
      value: status,
      label: status,
      count: count as number,
    }),
  );

  const typeFilters: ui.FilterDefinition[] = Object.entries(counts.byType).map(([type, count]) => ({
    key: 'type',
    value: type,
    label: type,
    count: count as number,
  }));

  const allFilters = [...moduleFilters, ...statusFilters, ...typeFilters];

  const isFilterActive = (q: MessageQuery, key: string, value: any) => {
    return q[key as keyof MessageQuery] === value;
  };

  const updateQuery = (currentQuery: MessageQuery, key: string, value: any) => {
    if (currentQuery[key as keyof MessageQuery] === value) {
      // Remove the filter
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key as keyof MessageQuery]: _, ...rest } = currentQuery;
      return rest;
    } else {
      // Add/update the filter
      return { ...currentQuery, [key]: value };
    }
  };

  const clearFilters = (currentQuery: MessageQuery) => {
    // Preserve search term if it exists
    return currentQuery.search ? { search: currentQuery.search } : {};
  };

  const hasActiveFilters = (q: MessageQuery) => {
    return Object.keys(q).some((key) => key !== 'search');
  };

  const updateQuerySearch = (q: MessageQuery, searchTerm: string | undefined) => {
    if (searchTerm === undefined) {
      // Remove search from query
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { search: _, ...rest } = q;
      return rest;
    } else {
      // Add/update search in query
      return { ...q, search: searchTerm };
    }
  };

  return (
    <PageFrame
      title="System Messages"
      description="Message processing logs and system events"
      className="max-w-screen-xl mx-auto"
    >
      <ui.FilterableList
        searchComponent={
          <ui.QuerySearch
            searchTerm={query.search}
            resultCount={messages.length}
            placeholder="Search messages by ID, module, type, or status..."
            resultLabel="message"
            parseQuery={parseMessageQuery}
            buildQuery={buildMessageQuery}
            updateQuerySearch={updateQuerySearch}
          />
        }
        filterBar={
          <ui.FilterBar
            filters={allFilters}
            parseQuery={parseMessageQuery}
            buildQuery={buildMessageQuery}
            isFilterActive={isFilterActive}
            updateQuery={updateQuery}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            totalCount={counts.total as number}
          />
        }
        items={messages}
        renderItem={renderMessage}
        getItemKey={(message: any) => message.id}
        emptyMessage="No messages found in the system."
      />
    </PageFrame>
  );
}
