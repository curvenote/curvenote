import { z } from 'zod';

// Message query schema
export const MessageQuerySchema = z.object({
  search: z.string().optional(),
  module: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
});

export type MessageQuery = z.infer<typeof MessageQuerySchema>;

// Parse query from single 'q' parameter using schema
export function parseMessageQuery(qValue: string): MessageQuery {
  try {
    // Decode the URL-encoded query string
    const decodedQuery = decodeURIComponent(qValue);

    // Parse the query string into URLSearchParams
    const searchParams = new URLSearchParams(decodedQuery);

    // Extract parameters
    const params: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }

    // Parse and validate with Zod
    return MessageQuerySchema.parse(params);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // If parsing fails, return empty object
    return {};
  }
}

// Build query string from message query object
export function buildMessageQuery(query: MessageQuery): string {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }

  if (query.module) {
    params.set('module', query.module);
  }

  if (query.status) {
    params.set('status', query.status);
  }

  if (query.type) {
    params.set('type', query.type);
  }

  return params.toString();
}
