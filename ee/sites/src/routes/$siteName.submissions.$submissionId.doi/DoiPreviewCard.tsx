import { Download } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import { previewFileName, xmlDataUrl } from './readiness.js';

type DoiPreviewCardProps = {
  submissionId: string;
  doi: string;
  xml: string;
};

export function DoiPreviewCard({ submissionId, doi, xml }: DoiPreviewCardProps) {
  return (
    <ui.Card className="px-6 py-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Deposit XML</h2>
        <ui.Button variant="outline" size="sm" asChild>
          <a href={xmlDataUrl(xml)} download={previewFileName(submissionId)}>
            <Download aria-hidden />
            Download XML
          </a>
        </ui.Button>
      </div>
      <div className="space-y-1">
        <div className="text-xs tracking-wide uppercase text-muted-foreground">DOI (preview)</div>
        <code className="text-sm">{doi}</code>
        <p className="text-sm font-light">
          A DOI under this prefix is assigned when you register. This one is a preview and is not
          reserved.
        </p>
      </div>
      <pre
        tabIndex={0}
        className="p-4 overflow-x-auto text-xs rounded-sm border border-border bg-stone-50 dark:bg-stone-900"
      >
        {xml}
      </pre>
    </ui.Card>
  );
}
