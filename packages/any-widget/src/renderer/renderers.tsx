/**
 * Forked from https://github.com/manzt/anymyst/commit/d0b2c105397f5b1a0344b4b467c3790c498a84c6
 *
 * A custom renderer for Myst to support anywidget front-end modules
 * @module
 *
 * @example
 * ```
 * <Document renderers={{ ...renderers, any:  AnyMystRenderer }}></Document>
 * ```
 */
import * as React from 'react';
import { useAnalytics } from '@curvenote/theme-ui';
import type { AnyWidgetDirective } from '../types.js';
import { captureAnywidgetClicked, getAnywidgetIdentity } from './analytics.js';
import { MystAnyModel } from './models.js';

export function AnyWidgetRenderer({ node }: { node: AnyWidgetDirective & { key?: string } }) {
  const capture = useAnalytics();
  const esmModuleUrl = node.data.esm ?? node.data.import;
  const isESMModuleUrlValid =
    esmModuleUrl &&
    typeof esmModuleUrl === 'string' &&
    (esmModuleUrl.startsWith('https://') || esmModuleUrl.startsWith('http://'));
  const validJson = node.data.json && typeof node.data.json === 'object';
  const ref = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const identity = getAnywidgetIdentity(node);

  const handleClick = React.useCallback(() => {
    captureAnywidgetClicked(capture, identity);
  }, [capture, identity]);

  React.useEffect(() => {
    if (!isESMModuleUrlValid || !validJson) {
      return;
    }

    setError(null);
    const controller = new AbortController();
    if (controller.signal.aborted) {
      return;
    }

    let maybeCleanupInitialize: (() => void | Promise<void>) | undefined;
    let maybeCleanupRender: (() => void | Promise<void>) | undefined;
    controller.signal.addEventListener('abort', async () => {
      await maybeCleanupRender?.();
      await maybeCleanupInitialize?.();
    });

    import(esmModuleUrl)
      .then(async (mod) => {
        if (!ref.current) return;
        const widget = mod.default;
        const model = new MystAnyModel(node.data.json);
        maybeCleanupInitialize = await widget.initialize?.({ model });
        ref.current.replaceChildren();
        if (node.data.class && node.data.class.trim().length > 0) {
          node.data.class
            .trim()
            .split(' ')
            .forEach((className: string) => {
              ref.current?.classList.add(className);
            });
        }

        let rootEl = ref.current;
        const shadow = true;
        const css = node.data.css ?? node.data.styles;
        if (css) {
          if (shadow) {
            const shadowRoot = rootEl.shadowRoot ?? rootEl.attachShadow({ mode: 'open' });
            shadowRoot.replaceChildren();
            const shadowEl = document.createElement('div');
            shadowRoot.appendChild(shadowEl);
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = css;
            shadowRoot.appendChild(link);
            rootEl = shadowEl;
          } else {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = css;
            rootEl.appendChild(link);
          }
        }

        maybeCleanupRender = await widget.render?.({
          model,
          el: rootEl,
        });
      })
      .catch((err: unknown) => {
        console.error('AnyRenderer failed to import module:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      controller.abort();
    };
  }, [esmModuleUrl, isESMModuleUrlValid, node, validJson]);

  if (error) {
    return (
      <details
        className="p-3 bg-gray-100 rounded border border-gray-300 cursor-pointer"
        onClick={handleClick}
      >
        <summary className="text-sm text-gray-600 select-none">
          Failed to load <code className="text-xs">any:widget</code> module.
        </summary>
        <div className="pt-2 mt-2 space-y-1 text-xs border-t border-gray-200">
          <div className="text-gray-500">
            <span className="font-medium">Widget Module URL:</span> {esmModuleUrl}
          </div>
          <div className="text-gray-700">
            <span className="font-medium">Error:</span> {error.message}
          </div>
          <div className="text-gray-700">
            <span className="font-medium">Stack:</span> {error.stack}
          </div>
        </div>
      </details>
    );
  }

  if (!isESMModuleUrlValid || !validJson) {
    return (
      <div className="p-3 space-y-2 rounded-md border border-red-500" onClick={handleClick}>
        <div>
          Invalid <code>any:bundle</code> directive.
        </div>
        {!isESMModuleUrlValid && (
          <div className="px-1">
            <div>Invalid import URL</div>
            <div className="text-sm text-gray-500">{node.data.import}</div>
          </div>
        )}
        {!validJson && (
          <div className="px-1">
            <div>Invalid JSON data</div>
            <div className="text-sm text-gray-500">{node.data.json?.toString()}</div>
          </div>
        )}
      </div>
    );
  }

  return <div className="relative w-full" ref={ref} onClick={handleClick} />;
}
