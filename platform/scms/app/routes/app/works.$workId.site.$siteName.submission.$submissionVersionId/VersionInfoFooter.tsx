import { primitives, ui, formatDate } from '@curvenote/scms-core';
import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

type VersionPanelData = {
  versionId: string;
  date: Date | string;
  uploadedBy: string;
  status: string;
  doi?: string | null;
  workKey?: string | null;
  isActive: boolean;
  isViewing: boolean;
};

type VersionInfoFooterProps = {
  activeVersionPanel: VersionPanelData;
  viewingVersionPanel?: VersionPanelData;
  overallStatus?: string;
  publishedVersionLink?: string | null;
};

export function VersionInfoFooter({
  activeVersionPanel,
  viewingVersionPanel,
  overallStatus,
  publishedVersionLink,
}: VersionInfoFooterProps) {
  const [doiCopied, setDoiCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  function handleCopy(text: string, type: 'doi' | 'key') {
    navigator.clipboard.writeText(text);
    if (type === 'doi') {
      setDoiCopied(true);
      setTimeout(() => setDoiCopied(false), 2000);
    } else {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  }

  const statusVariant = overallStatus === 'published' ? 'success' : 'default';
  const statusLabel = overallStatus
    ? overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)
    : 'Unknown';

  // Determine if viewing a different version than active
  const isViewingDifferent =
    viewingVersionPanel && viewingVersionPanel.versionId !== activeVersionPanel.versionId;
  const displayVersion = isViewingDifferent ? viewingVersionPanel : activeVersionPanel;

  return (
    <primitives.Card lift className="p-6">
      <div className="space-y-6">
        {/* Status and Published Link Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Status</div>
            <ui.Badge variant={statusVariant} className="text-base">
              {statusLabel}
            </ui.Badge>
          </div>
          {publishedVersionLink && (
            <ui.Button asChild variant="default" size="sm">
              <a
                href={publishedVersionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Published Version
              </a>
            </ui.Button>
          )}
        </div>

        {/* Version Details */}
        <div className="pt-4 space-y-3 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase">
                {isViewingDifferent ? 'Viewing Version' : 'Active Version'}
              </div>
              <div className="text-sm text-gray-700">
                {formatDate(new Date(displayVersion.date).toISOString(), 'MMM d, yyyy h:mm a')}
              </div>
              <div className="text-sm text-gray-600">Uploaded by {displayVersion.uploadedBy}</div>
            </div>
            {isViewingDifferent && <ui.Badge variant="outline">Viewing Different Version</ui.Badge>}
          </div>
        </div>

        {/* Published URL, DOI and Work Key */}
        <div className="pt-4 space-y-3 border-t">
          {publishedVersionLink && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Published URL</span>
              <div className="flex items-center max-w-md gap-2">
                <a
                  href={publishedVersionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-blue-600 truncate hover:underline"
                >
                  {publishedVersionLink}
                </a>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">DOI</span>
            <div className="flex items-center gap-2">
              {displayVersion.doi ? (
                <>
                  <span className="font-mono text-sm text-gray-900">{displayVersion.doi}</span>
                  <ui.Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(displayVersion.doi!, 'doi')}
                    className="px-2 h-7"
                  >
                    <Copy className="w-3 h-3" />
                    {doiCopied && <span className="ml-1 text-xs">Copied!</span>}
                  </ui.Button>
                </>
              ) : (
                <span className="text-sm text-gray-500">Not assigned yet</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Work Key</span>
            <div className="flex items-center gap-2">
              {displayVersion.workKey ? (
                <>
                  <span className="font-mono text-sm text-gray-900">{displayVersion.workKey}</span>
                  <ui.Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(displayVersion.workKey!, 'key')}
                    className="px-2 h-7"
                  >
                    <Copy className="w-3 h-3" />
                    {keyCopied && <span className="ml-1 text-xs">Copied!</span>}
                  </ui.Button>
                </>
              ) : (
                <span className="text-sm text-gray-500">Not available</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </primitives.Card>
  );
}
