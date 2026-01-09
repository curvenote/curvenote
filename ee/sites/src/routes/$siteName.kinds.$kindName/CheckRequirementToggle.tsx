import { ui, cn } from '@curvenote/scms-core';
import { OctagonAlert, CircleAlert } from 'lucide-react';
import { useFetcher } from 'react-router';
import { useState } from 'react';
import type { Check } from '@curvenote/check-definitions';

export function CheckRequirementToggle({ check }: { check: Check }) {
  const fetcher = useFetcher();
  const [value, setValue] = useState<string>(check.optional ? 'warn' : 'require');
  return (
    <div className="flex flex-col w-full gap-2 px-6 py-6">
      <h3 className="mb-2 text-lg font-semibold">What happens if a paper fails this check?</h3>
      <ui.ToggleGroup
        type="single"
        className="flex justify-start gap-3"
        value={value}
        aria-label="Check requirement level"
        onValueChange={(newValue) => {
          if (!newValue) return;
          setValue(newValue);
          const formData = new FormData();
          formData.append('intent', 'update-kind-check-optional');
          formData.append('checkId', check.id);
          formData.append('optional', newValue);
          fetcher.submit(formData, { method: 'post' });
        }}
      >
        <ui.ToggleGroupItem
          value="require"
          aria-label="Require - Block submission"
          className={cn(
            'inline-flex items-center gap-2 px-5 py-3 rounded-lg font-medium text-sm border',
            'justify-center transition-colors duration-150 cursor-pointer',
            'bg-white border-transparent font-light text-inherit shadow-sm',
            'data-[state=on]:bg-red-50 data-[state=on]:border-red-500 data-[state=on]:text-red-500',
            'focus-visible:ring-2 focus-visible:ring-red-500',
          )}
        >
          <OctagonAlert className="w-5 h-5 stroke-[1.5px] stroke-red-500" aria-hidden="true" />
          Require - Block submission
        </ui.ToggleGroupItem>
        <ui.ToggleGroupItem
          value="warn"
          aria-label="Warn - Just suggest they fix it"
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm border',
            'justify-center transition-colors duration-150 cursor-pointer',
            'bg-white border-transparent font-light text-inherit shadow-sm',
            'data-[state=on]:bg-yellow-100 data-[state=on]:border-yellow-700 data-[state=on]:text-yellow-700',
            'focus-visible:ring-2 focus-visible:ring-yellow-500',
          )}
        >
          <CircleAlert className="w-8 h-8 stroke-[1.5px] stroke-yellow-700" aria-hidden="true" />
          Warn - Just suggest they fix it
        </ui.ToggleGroupItem>
      </ui.ToggleGroup>
    </div>
  );
}
