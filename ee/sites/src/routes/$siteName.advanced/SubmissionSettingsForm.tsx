import { useFetcher } from 'react-router';
import { primitives, ui } from '@curvenote/scms-core';
import { useState } from 'react';
import type { SiteDTO } from '@curvenote/common';

export function SubmissionSettingsForm({ site }: { site: SiteDTO & { restricted: boolean } }) {
  const fetcher = useFetcher<{ error?: string; info?: string }>();
  const [restricted, setRestricted] = useState(site.restricted);
  const [dirty, setDirty] = useState(false);

  const handleReset = () => {
    setRestricted(site.restricted);
    setDirty(false);
  };

  return (
    <primitives.Card lift className="max-w-4xl px-6 space-y-4" validateUsing={fetcher}>
      <h2>Submission Settings</h2>
      <p className="text-sm font-light">
        This setting controls who can make submissions to the venue. Private venues are always
        restricted.
      </p>
      <fetcher.Form method="POST" className="m-0 space-y-4" onSubmit={() => setDirty(false)}>
        <input type="hidden" name="formAction" value="restrict" />
        <div className="flex items-center space-x-6">
          <div className="flex-none">
            <ui.SimpleTooltip
              title={
                site.private
                  ? 'Submissions on private sites are always restricted to users below with submit permissions'
                  : restricted
                    ? 'Removing this restriction means any curvenote user can submit'
                    : 'Restrict submissions to users below with submit permissions'
              }
            >
              <div className="flex items-center space-x-2">
                <ui.Checkbox
                  id="settings.restricted"
                  name="restricted"
                  value="restricted"
                  checked={restricted}
                  disabled={site.private}
                  onCheckedChange={(checked: boolean) => {
                    setDirty(true);
                    setRestricted(checked);
                  }}
                />
                <label
                  htmlFor="settings.restricted"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Restrict Submissions
                </label>
              </div>
            </ui.SimpleTooltip>
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <ui.Button
            type="button"
            variant="secondary"
            disabled={!dirty || site.private || fetcher.state !== 'idle'}
            onClick={handleReset}
          >
            Reset
          </ui.Button>
          <ui.StatefulButton
            variant="default"
            disabled={site.private || !dirty || fetcher.state !== 'idle'}
            overlayBusy
            busy={fetcher.state === 'submitting'}
            type="submit"
          >
            Save
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </primitives.Card>
  );
}
