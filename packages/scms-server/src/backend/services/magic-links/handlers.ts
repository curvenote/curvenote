import type { MagicLink } from '@prisma/client';
import type { Context } from '../../context.server.js';

export interface MagicLinkHandler {
  /**
   * Handles a validated magic link and returns a redirect URL
   */
  handle(
    magicLink: MagicLink,
    context: Context,
    logContext: { ipAddress?: string; userAgent?: string },
  ): Promise<string>;
}

/**
 * Get handler for a specific type (simple dictionary lookup)
 * In future: Can merge with extension handlers like email templates
 */
export function getHandler(
  type: string,
  handlers: Record<string, MagicLinkHandler>,
): MagicLinkHandler | undefined {
  return handlers[type];
}
