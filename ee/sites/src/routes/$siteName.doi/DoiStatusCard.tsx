import { ui } from '@curvenote/scms-core';
import type { SiteDoiConfigDTO } from '../../backend/doi/types.js';
import { methodLabel, statusPresentation } from './doi.utils.js';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 border rounded-sm border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">
      <div className="text-xs tracking-wide uppercase text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

type DoiStatusCardProps = {
  config: SiteDoiConfigDTO;
};

export function DoiStatusCard({ config }: DoiStatusCardProps) {
  const status = statusPresentation(config.status);
  return (
    <ui.Card className="px-6 py-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2>DOI registration status</h2>
        <ui.Badge variant={status.variant}>{status.label}</ui.Badge>
      </div>
      {status.description && <p className="text-sm font-light">{status.description}</p>}
      {config.attention_reason && (
        <ui.SimpleAlert
          type="error"
          size="compact"
          message={
            <>
              <span className="font-medium">Crossref said:</span>{' '}
              <code className="text-xs break-words">{config.attention_reason}</code>
            </>
          }
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="Registration method" value={methodLabel(config.mode)} />
        <Fact label="Registration agency" value="Crossref" />
      </div>
    </ui.Card>
  );
}
