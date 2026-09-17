import { Lock } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';

export type RegistrationMethod = 'curvenote' | 'custom';

type MethodOptionProps = {
  value: RegistrationMethod;
  selected: boolean;
  title: string;
  badge: React.ReactNode;
  description: string;
};

function MethodOption({ value, selected, title, badge, description }: MethodOptionProps) {
  const id = `doi-method-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-3 p-4 border rounded-sm cursor-pointer',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-stone-200 hover:border-stone-400 dark:border-stone-600',
      )}
    >
      <ui.RadioGroupItem value={value} id={id} className="mt-1" />
      <span className="space-y-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title}
          {badge}
        </span>
        <span className="block text-sm font-light">{description}</span>
      </span>
    </label>
  );
}

type RegistrationMethodPickerProps = {
  value: RegistrationMethod;
  onChange: (value: RegistrationMethod) => void;
  customPrefixEnabled: boolean;
  siteTitle: string;
  onUpgrade: () => void;
};

export function RegistrationMethodPicker({
  value,
  onChange,
  customPrefixEnabled,
  siteTitle,
  onUpgrade,
}: RegistrationMethodPickerProps) {
  const customDescription = `Register DOIs using ${siteTitle}'s own prefix and Crossref membership.`;
  return (
    <ui.RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as RegistrationMethod)}
      className="grid gap-3"
    >
      <MethodOption
        value="curvenote"
        selected={value === 'curvenote'}
        title="Use Curvenote-managed registration"
        badge={<ui.Badge variant="neutral">Included</ui.Badge>}
        description="Register DOIs using Curvenote's prefix. No Crossref account is required."
      />
      {customPrefixEnabled ? (
        <MethodOption
          value="custom"
          selected={value === 'custom'}
          title="Use your own DOI prefix"
          badge={<ui.Badge variant="primary">Enterprise</ui.Badge>}
          description={customDescription}
        />
      ) : (
        // Not a radio: a locked option cannot be chosen, so it is not part of the group.
        <div className="flex items-start gap-3 p-4 border border-dashed rounded-sm border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">
          <Lock className="w-4 h-4 mt-1 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Use your own DOI prefix
              <ui.Badge variant="primary">Enterprise</ui.Badge>
            </div>
            <p className="text-sm font-light">{customDescription}</p>
            <button type="button" className="text-sm underline text-primary" onClick={onUpgrade}>
              Upgrade to Enterprise
            </button>
          </div>
        </div>
      )}
    </ui.RadioGroup>
  );
}
