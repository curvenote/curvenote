import React, { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from './LoadingSpinner.js';

interface LoadableIframeProps {
  src: string;
  width?: string;
  height?: string;
  className?: string;
  style?: React.CSSProperties;
  sandbox?: string;
  allow?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  loading?: 'lazy' | 'eager';
  frameBorder?: string;
  /** Debug mode - prevents iframe from completing load to test loading states */
  debug?: boolean;
}

type LoadingState = 'loading' | 'continuing' | 'slow' | 'timeout' | 'loaded';

/**
 * LoadableIframe: An iframe component with a loading indicator
 *
 * Shows a loading spinner while the iframe content is loading.
 * The loading indicator is positioned absolutely over the iframe area
 * without affecting the iframe's dimensions.
 *
 * Progressive loading messages:
 * - 0-4s: "Loading content..."
 * - 4-8s: "Continuing to load content..."
 * - 8-20s: "Taking longer than usual, please wait..."
 * - 20s+: "Failed to load content." (timeout error)
 */
export function LoadableIframe({
  src,
  width = '100%',
  height = '533',
  className = '',
  style,
  sandbox,
  allow,
  referrerPolicy,
  loading = 'lazy',
  frameBorder = '0',
  debug = false,
}: LoadableIframeProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Debug mode initial log
  useEffect(() => {
    if (debug) {
      console.log('[LoadableIframe Debug] Debug mode enabled - iframe will not complete loading');
    }
  }, [debug]);

  // Set up timeouts once when component mounts
  useEffect(() => {
    if (debug) {
      console.log('[LoadableIframe Debug] Setting up timeouts...');
    }

    // Set progressive loading message timeouts
    const timeout4s = setTimeout(() => {
      if (debug) {
        console.log('[LoadableIframe Debug] 4s timeout - changing to continuing');
      }
      setLoadingState('continuing');
    }, 4000);

    const timeout8s = setTimeout(() => {
      if (debug) {
        console.log('[LoadableIframe Debug] 8s timeout - changing to slow');
      }
      setLoadingState('slow');
    }, 8000);

    const timeout20s = setTimeout(() => {
      if (debug) {
        console.log('[LoadableIframe Debug] 30s timeout - changing to timeout');
      }
      setLoadingState('timeout');
    }, 30000);

    timeoutsRef.current = [timeout4s, timeout8s, timeout20s];

    // Cleanup timeouts on unmount
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Log state changes in debug mode
  useEffect(() => {
    if (debug) {
      console.log('[LoadableIframe Debug] State changed to:', loadingState);
    }
  }, [loadingState, debug]);

  const handleLoad = () => {
    if (debug) {
      console.log('[LoadableIframe Debug] Iframe loaded, but debug mode prevents completion');
      return;
    }
    setLoadingState('loaded');
    timeoutsRef.current.forEach(clearTimeout);
  };

  const handleError = () => {
    if (debug) {
      console.log('[LoadableIframe Debug] Iframe error occurred');
    }
    setLoadingState('timeout');
    timeoutsRef.current.forEach(clearTimeout);
  };

  const getLoadingMessage = () => {
    switch (loadingState) {
      case 'loading':
        return 'Loading content...';
      case 'continuing':
        return 'Continuing to load content...';
      case 'slow':
        return 'Taking longer than usual, please wait...';
      case 'timeout':
        return 'Failed to load content.';
      default:
        return 'Loading content...';
    }
  };

  const showLoadingOverlay = loadingState !== 'loaded';

  return (
    <div className="relative">
      {/* Loading indicator overlay */}
      {showLoadingOverlay && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center border border-gray-300 rounded bg-gray-50"
          style={{
            width: width === '100%' ? '100%' : width,
            height: height,
          }}
        >
          <div className="flex flex-col items-center gap-3">
            {loadingState !== 'timeout' && <LoadingSpinner size={32} color="text-blue-500" />}
            <span className="text-sm text-gray-600">{getLoadingMessage()}</span>
          </div>
        </div>
      )}

      {/* The actual iframe */}
      <iframe
        src={src}
        width={width}
        height={height}
        frameBorder={frameBorder}
        className={className}
        style={style}
        sandbox={sandbox}
        allow={allow}
        referrerPolicy={referrerPolicy}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
