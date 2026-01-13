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
import type { AnyWidgetDirective } from '../types.js';
import { MystAnyModel } from './models.js';

export function AnyWidgetRenderer({ node }: { node: AnyWidgetDirective }) {
  // basic validation
  const esmModuleUrl = node.data.esm ?? node.data.import; // supports legacy import URL
  const isESMModuleUrlValid =
    esmModuleUrl &&
    typeof esmModuleUrl === 'string' &&
    (esmModuleUrl.startsWith('https://') || esmModuleUrl.startsWith('http://'));
  const validJson = node.data.json && typeof node.data.json === 'object';

  const ref = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<Error | null>(null);
  React.useEffect(() => {
    // Reset error state on node change
    setError(null);

    // @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal#implementing_an_abortable_api
    const controller = new AbortController();

    // if already aborted just ignore
    if (controller.signal.aborted) {
      return;
    }

    let maybeCleanupInitialize: undefined | (() => void | Promise<void>) = undefined;
    let maybeCleanupRender: undefined | (() => void | Promise<void>) = undefined;

    controller.signal.addEventListener('abort', async () => {
      await maybeCleanupRender?.();
      await maybeCleanupInitialize?.();
    });

    // TODO: validation for import & styles URLs

    console.debug('AnyRenderer importing:', esmModuleUrl);
    import(esmModuleUrl)
      .then(async (mod) => {
        if (!ref.current) return;
        console.debug('AnyRenderer imported', mod);
        const widget = mod.default;
        // TODO: validate the widget
        const model = new MystAnyModel(node.data.json);
        maybeCleanupInitialize = await widget.initialize?.({ model });

        // clear current contents
        ref.current?.replaceChildren();

        // apply container classes
        if (node.data.class && node.data.class?.trim().length > 0) {
          node.data.class
            ?.trim()
            .split(' ')
            .forEach((c) => {
              ref.current?.classList.add(c);
            });
        }

        // apply styles
        let rootEl = ref.current;

        const shadow = true;
        const css = node.data.css ?? node.data.styles; // supports legacy styles
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
      .catch((err) => {
        console.error('AnyRenderer failed to import module:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      controller?.abort();
    };
  }, [node]);

  if (error) {
    return (
      <details className="p-3 bg-gray-100 rounded border border-gray-300 cursor-pointer">
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
      <div className="p-3 space-y-2 rounded-md border border-red-500">
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
            <div className="text-sm text-gray-500">{(node.data.json as any)?.toString()}</div>
          </div>
        )}
      </div>
    );
  }

  return <div className="relative w-full" ref={ref} />;
}
