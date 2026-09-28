import { ui } from '@curvenote/scms-core';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { explainRedirect } from '../../themeConfig/explain.js';
import type { ThemeRedirectsConfig } from '../../themeConfig/types.js';
import { GROUP_LABELS } from '../../themeConfig/validate.js';

/**
 * Type a path, see what the redirects *as currently edited* would do with it — run through the
 * same matcher the theme uses, so the answer is the answer. `hostname` is the site's default
 * domain; it only matters for the self-redirect guard and for showing absolute destinations.
 */
export function RedirectTester({
  config,
  hostname,
}: {
  config: ThemeRedirectsConfig | undefined;
  hostname: string;
}) {
  const [path, setPath] = useState('');
  const [notFound, setNotFound] = useState(false);

  let result: React.ReactNode = null;
  const trimmed = path.trim();
  if (trimmed) {
    let url: URL | undefined;
    try {
      url = new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, `https://${hostname}`);
    } catch {
      url = undefined;
    }
    if (!url) {
      result = <span className="text-sm text-red-600">That is not a path we can test.</span>;
    } else {
      const explanation = explainRedirect(url, config, { notFound });
      if (explanation.kind === 'none') {
        result = (
          <span className="text-sm text-muted-foreground">
            No redirect
            {explanation.reserved &&
              ' — this is a theme path; only a rule naming it exactly would apply'}
            .
          </span>
        );
      } else {
        const via =
          explanation.kind === 'rule'
            ? `rule ${explanation.index + 1}`
            : GROUP_LABELS[explanation.kind].toLowerCase();
        result = (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <ui.Badge variant="secondary">{explanation.resolution.status}</ui.Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <code className="break-all">{explanation.resolution.to}</code>
            <span className="text-xs text-muted-foreground">({via})</span>
          </span>
        );
      }
    }
  }

  return (
    <div className="p-3 space-y-2 border rounded-md bg-muted/30">
      <ui.Label htmlFor="redirect-tester" className="text-sm font-semibold">
        Test a path
      </ui.Label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">https://{hostname}</span>
        <ui.Input
          id="redirect-tester"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/about"
          className="flex-1 min-w-[12rem] font-mono text-sm"
        />
        <label className="flex items-center gap-2 text-xs">
          <ui.Checkbox checked={notFound} onCheckedChange={(c) => setNotFound(c === true)} />
          Treat as a missing page
        </label>
      </div>
      <div className="min-h-[1.5rem]">{result}</div>
    </div>
  );
}
