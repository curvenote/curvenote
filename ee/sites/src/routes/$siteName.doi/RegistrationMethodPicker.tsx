import { Lock } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import { CONTACT_SALES_URL } from './doi.utils.js';

type RegistrationMethodPickerProps = {
  siteTitle: string;
};

/**
 * Shown only to sites without the own-prefix flag: Curvenote-managed is the one choice, and the
 * own prefix is listed locked so the Enterprise option stays visible.
 */
export function RegistrationMethodPicker({ siteTitle }: RegistrationMethodPickerProps) {
  return (
    <ui.RadioGroup value="curvenote" className="grid gap-3">
      <label
        htmlFor="doi-method-curvenote"
        className="flex items-start gap-3 p-4 border rounded-sm cursor-pointer border-primary bg-primary/5"
      >
        <ui.RadioGroupItem value="curvenote" id="doi-method-curvenote" className="mt-1" />
        <span className="space-y-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            Use Curvenote-managed registration
            <ui.Badge variant="neutral">Included</ui.Badge>
          </span>
          <span className="block text-sm font-light">
            Register DOIs using Curvenote&apos;s prefix. No Crossref account is required.
          </span>
        </span>
      </label>
      {/* Not a radio: a locked option cannot be chosen, so it is not part of the group. */}
      <div className="flex items-start gap-3 p-4 border border-dashed rounded-sm border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800">
        <Lock className="w-4 h-4 mt-1 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            Use your own DOI prefix
            <ui.Badge variant="primary">Enterprise</ui.Badge>
          </div>
          <p className="text-sm font-light">
            Register DOIs using {siteTitle}&apos;s own prefix and Crossref account.
          </p>
          <ui.Button asChild variant="outline" size="sm">
            <a href={CONTACT_SALES_URL} target="_blank" rel="noopener noreferrer">
              Upgrade to Enterprise
            </a>
          </ui.Button>
        </div>
      </div>
    </ui.RadioGroup>
  );
}
