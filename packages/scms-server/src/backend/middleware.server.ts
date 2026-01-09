import { createContext } from 'react-router';
import { AnalyticsContext } from './services/analytics/segment.server.js';

/**
 * React Router context for sharing AnalyticsContext instance between middleware and route handlers.
 * Middleware creates the analytics instance and stores it here, then withContext() retrieves it.
 */
export const analyticsContext = createContext<AnalyticsContext>();

/**
 * Middleware to handle analytics flushing for all framework routes.
 * Creates an AnalyticsContext instance, stores it in RouterContextProvider,
 * and flushes it after handlers complete.
 *
 * This is a generic function that accepts the route-specific middleware type
 * for proper type safety. Usage in route files:
 *
 * @example
 * ```typescript
 * export const middleware: Route.MiddlewareFunction[] = [analyticsMiddleware];
 * ```
 *
 * @template T - The route-specific middleware function type (e.g., Route.MiddlewareFunction)
 */
export function analyticsMiddleware<
  T extends (
    args: { context: { set: (key: any, value: any) => void; get: (key: any) => any } },
    next: () => Promise<Response>,
  ) => Promise<Response>,
>(args: Parameters<T>[0], next: Parameters<T>[1]): ReturnType<T> {
  // Create analytics instance for all routes
  const analytics = new AnalyticsContext();

  // Store in RouterContextProvider so withContext() can use it
  args.context.set(analyticsContext, analytics);

  // Run handlers (loaders/actions)
  // Note: next() always returns a Response, even when handlers throw errors/redirects.
  // React Router converts thrown errors/redirects into Response objects.
  return next().finally(async () => {
    // Flush analytics after handlers complete (success or error)
    // Wrap in try/catch to ensure flush failures don't override the original response
    try {
      await analytics.flush();
    } catch (error) {
      // Log but don't fail the request if analytics flush fails
      console.error('Analytics flush failed:', error);
    }
  }) as ReturnType<T>;
}
