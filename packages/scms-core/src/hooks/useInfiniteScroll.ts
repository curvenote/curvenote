import { useEffect, useRef } from 'react';
import { useHydrated } from './useHydrated.js';

/**
 * Options for configuring the infinite scroll behavior.
 */
interface UseInfiniteScrollOptions {
  /**
   * Whether data is currently being loaded.
   * When true, the hook will not trigger onLoadMore even if the scroll target is visible.
   */
  loading: boolean;
  /**
   * Whether there are more items available to load.
   * When false, the intersection observer will not trigger onLoadMore.
   */
  hasNextPage: boolean;
  /**
   * Callback function invoked when the user scrolls near the bottom and more items should be loaded.
   * This function is called automatically when the infiniteRef element comes into view.
   */
  onLoadMore: () => void;
  /**
   * Root margin for the IntersectionObserver, following CSS margin syntax.
   * Controls how far before the element enters the viewport the callback should trigger.
   * @default '0px 0px 10px 0px'
   */
  rootMargin?: string;
  /**
   * Whether the infinite scroll functionality is enabled.
   * When false, the intersection observer will not be set up.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Return value from the useInfiniteScroll hook.
 */
interface UseInfiniteScrollReturn {
  /**
   * Ref to attach to the element that should trigger loading when it comes into view.
   * Typically attached to a loading indicator or sentinel element at the bottom of the list.
   */
  infiniteRef: React.RefObject<HTMLDivElement>;
  /**
   * Ref to attach to the scrollable container element.
   * If provided, the intersection observer will use this element as the root.
   * If null, the viewport will be used as the root.
   */
  rootRef: React.RefObject<HTMLDivElement>;
}

/**
 * A SSR-safe infinite scroll hook that uses IntersectionObserver to detect when
 * the user has scrolled near the bottom of a list and triggers loading more items.
 *
 * This hook automatically handles server-side rendering by only setting up the
 * IntersectionObserver on the client side after hydration, preventing React hook
 * errors during SSR.
 *
 * @param {UseInfiniteScrollOptions} options - Configuration options for the infinite scroll behavior.
 * @param {boolean} options.loading - Whether data is currently being loaded.
 * @param {boolean} options.hasNextPage - Whether there are more items available to load.
 * @param {() => void} options.onLoadMore - Callback function to load more items.
 * @param {string} [options.rootMargin='0px 0px 10px 0px'] - Root margin for the IntersectionObserver.
 * @param {boolean} [options.enabled=true] - Whether the infinite scroll is enabled.
 *
 * @returns {UseInfiniteScrollReturn} An object containing refs to attach to DOM elements.
 * @returns {React.RefObject<HTMLDivElement>} infiniteRef - Ref for the trigger element.
 * @returns {React.RefObject<HTMLDivElement>} rootRef - Ref for the scrollable container.
 *
 * @example
 * Basic usage with a fetcher:
 * ```tsx
 * const fetcher = useFetcher();
 * const { infiniteRef, rootRef } = useInfiniteScroll({
 *   loading: fetcher.state !== 'idle',
 *   hasNextPage: submissions.hasMore,
 *   onLoadMore: () => {
 *     const formData = new FormData();
 *     formData.append('page', (currentPage + 1).toString());
 *     fetcher.submit(formData, { method: 'post' });
 *   },
 * });
 *
 * return (
 *   <div ref={rootRef} className="h-screen overflow-y-scroll">
 *     <ItemList items={items} />
 *     {hasNextPage && (
 *       <div ref={infiniteRef} className="flex justify-center p-4">
 *         <div className="text-sm text-gray-500">Loading more...</div>
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 *
 * @example
 * With custom root margin for earlier triggering:
 * ```tsx
 * const { infiniteRef, rootRef } = useInfiniteScroll({
 *   loading: isLoading,
 *   hasNextPage: hasMore,
 *   onLoadMore: loadMore,
 *   rootMargin: '0px 0px 200px 0px', // Trigger 200px before bottom
 * });
 * ```
 *
 * @example
 * Conditionally enabling infinite scroll:
 * ```tsx
 * const { infiniteRef, rootRef } = useInfiniteScroll({
 *   loading: isLoading,
 *   hasNextPage: hasMore,
 *   onLoadMore: loadMore,
 *   enabled: !isFiltering, // Disable while filtering
 * });
 * ```
 */
export function useInfiniteScroll({
  loading,
  hasNextPage,
  onLoadMore,
  rootMargin = '0px 0px 10px 0px',
  enabled = true,
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  const isHydrated = useHydrated();
  const infiniteRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !isHydrated || typeof window === 'undefined') {
      return;
    }

    const currentInfiniteRef = infiniteRef.current;
    const currentRootRef = rootRef.current;

    if (!currentInfiniteRef) {
      return;
    }

    // Set up intersection observer manually for client-side only
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasNextPage && !loading) {
          onLoadMore();
        }
      },
      {
        root: currentRootRef,
        rootMargin,
      },
    );

    observer.observe(currentInfiniteRef);

    return () => {
      observer.disconnect();
    };
  }, [isHydrated, hasNextPage, loading, onLoadMore, rootMargin, enabled]);

  return {
    infiniteRef,
    rootRef,
  };
}
