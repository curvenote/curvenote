import { ui } from '@curvenote/scms-core';
import { Key } from 'lucide-react';

interface AnalyticsEvent {
  key: string;
  value: string;
  description: string;
  extensionName?: string;
}

interface AnalyticsEventListItemProps {
  event: AnalyticsEvent;
}

export function AnalyticsEventListItem({ event }: AnalyticsEventListItemProps) {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(event.key);
      ui.toastSuccess('Copied to clipboard', {
        description: `Event key: ${event.key}`,
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="flex flex-col w-full gap-3 lg:flex-row lg:gap-6">
      {/* Main Info Section */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-2">
          {/* Header row with event name and extension badge */}
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="flex flex-wrap items-center w-full min-w-0 gap-2">
              <h3 className="text-lg font-medium text-gray-900 truncate dark:text-gray-100">
                {event.value}
              </h3>
              <ui.SimpleTooltip title={`${event.key}`}>
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors cursor-pointer hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <Key className="w-4 h-4" />
                </button>
              </ui.SimpleTooltip>
              <div className="flex-grow" />
              {event.extensionName && (
                <ui.Badge variant="outline" className="text-xs">
                  {event.extensionName}
                </ui.Badge>
              )}
            </div>
          </div>

          {/* Description row */}
          <div className="text-sm text-gray-600 dark:text-gray-400">{event.description}</div>
        </div>
      </div>
    </div>
  );
}
