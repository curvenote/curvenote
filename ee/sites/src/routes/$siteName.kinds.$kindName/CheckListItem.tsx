import { useState } from 'react';
import { ui } from '@curvenote/scms-core';
import { Settings } from 'lucide-react';
import { CheckListItemTray } from './CheckListItemTray.js';
import { CheckRequirementToggle } from './CheckRequirementToggle.js';
import { CheckOptionsForm } from './CheckOptionsForm.js';
import { CheckDocsTray } from './CheckDocsTray.js';
import type { Check, CheckOptionDefinition } from '@curvenote/check-definitions';
import { useFetcher } from 'react-router';

export function CheckListItem({
  check,
  enabled,
  order,
}: {
  check: Check;
  enabled: boolean;
  order?: string[];
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const switchFetcher = useFetcher();

  const switchColor = check.optional
    ? 'data-[state=checked]:bg-yellow-400 dark:data-[state=checked]:bg-yellow-300'
    : 'data-[state=checked]:bg-green-600 dark:data-[state=checked]:bg-green-400';

  function handleCogClick() {
    setTrayOpen((open) => !open);
  }

  // Build summary of defined, non-boolean options with a value
  let optionSummary = '';
  if (Array.isArray(check.options)) {
    const summaryParts = (check.options as CheckOptionDefinition[])
      .filter((opt) => {
        const value = check[opt.id] ?? opt.default;
        return opt.type !== 'boolean' && value !== undefined && value !== null && value !== '';
      })
      .map(
        (opt) =>
          `${opt.id.charAt(0).toUpperCase() + opt.id.slice(1)}: ${check[opt.id] ?? opt.default}`,
      );
    if (summaryParts.length > 0) {
      optionSummary = summaryParts.join(', ');
    }
  }

  return (
    <div className="w-full">
      <div className={`flex items-center  ${enabled ? 'pl-6 pr-3 py-3' : 'px-6 py-5'}`}>
        <ui.Switch
          defaultChecked={!!enabled}
          aria-label={`Enable ${check.title}`}
          tabIndex={0}
          className={`mr-4 h-[1.7rem] w-12 [&_[data-slot=switch-thumb]]:h-6 [&_[data-slot=switch-thumb]]:w-6 cursor-pointer ${switchColor}`}
          onCheckedChange={(checked) => {
            switchFetcher.submit(
              {
                intent: 'update-kind-check-enabled',
                enabled: checked,
                checkId: check.id,
                order: order ?? null,
              },
              { method: 'post' },
            );
          }}
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-semibold text-base text-foreground truncate" title={check.title}>
            {check.title}
          </span>
          {optionSummary && (
            <span className="ml-2 text-sm text-muted-foreground font-normal">{optionSummary}</span>
          )}
          <span
            className="ml-4 text-sm text-muted-foreground truncate text-right flex-1"
            title={check.purpose}
          >
            {check.purpose}
          </span>
        </div>
        {enabled && (
          <ui.Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Configure ${check.title}`}
            tabIndex={0}
            className="cursor-pointer"
            aria-expanded={trayOpen}
            onClick={handleCogClick}
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </ui.Button>
        )}
      </div>
      {enabled && (
        <CheckListItemTray open={trayOpen}>
          <div className="w-full flex flex-col items-center justify-center pt-6 relative">
            <CheckOptionsForm check={check} />
            <CheckRequirementToggle check={check} />
            <CheckDocsTray check={check} />
          </div>
        </CheckListItemTray>
      )}
    </div>
  );
}
