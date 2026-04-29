import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../utils/cn.js';

/**
 * Renders the upstream service logo for a check extension.
 *
 * Resolution order (consumer-driven):
 *   1. `logoUrl` — if provided and the `<img>` loads, render the image.
 *   2. `fallback` — any React node (text, SVG icon component, etc.) otherwise.
 *
 * The component handles the SSR edge case where the image fails to load
 * before React hydrates by re-checking `HTMLImageElement.complete` /
 * `naturalWidth` on mount.
 *
 * Consumers compose their own fallback chain. For example, a "configured logo
 * → configured title → hardcoded default" chain can be expressed as:
 *
 *   <ServiceLogo
 *     logoUrl={manifest?.logo}
 *     fallback={<span>{manifest?.title ?? 'My Service'}</span>}
 *   />
 */
export function ServiceLogo({
  logoUrl,
  fallback,
  alt,
  className,
}: {
  /** Remote URL to render as an `<img>`; falls back to `fallback` when missing or failed. */
  logoUrl?: string;
  /** React node rendered when no logo URL is supplied or the image fails to load. */
  fallback?: ReactNode;
  /** Alt text for the `<img>`. Ignored when falling back. */
  alt?: string;
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setImgFailed(true);
    }
  }, []);

  if (logoUrl && !imgFailed) {
    return (
      <img
        ref={imgRef}
        src={logoUrl}
        alt={alt ?? 'Service logo'}
        className={className}
        onError={() => setImgFailed(true)}
      />
    );
  }

  if (fallback == null) return null;
  return <span className={cn(className, 'h-auto')}>{fallback}</span>;
}
