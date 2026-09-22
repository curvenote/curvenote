import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { InfoIcon } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import type { SiteWithAppData } from '../../backend/db.server.js';

type DoiCustomPrefixFormProps = {
  siteWithAppData: SiteWithAppData;
};

export function DoiCustomPrefixForm({ siteWithAppData }: DoiCustomPrefixFormProps) {
  const fetcher = useFetcher<{ error?: string; info?: string }>();
  const enabled = siteWithAppData.data?.doiCustomPrefixEnabled ?? false;
  const busy = fetcher.state !== 'idle';
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error);
      } else if (fetcher.data.info) {
        ui.toastSuccess(fetcher.data.info);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <ui.Card className="max-w-4xl px-6 py-4 space-y-4">
      <h2>DOI Registration</h2>
      <p className="text-sm font-light">
        Every Site can register DOIs under Curvenote&apos;s prefix. Registering under the
        Site&apos;s own Crossref prefix is an Enterprise feature.
      </p>
      <fetcher.Form method="POST" className="m-0 space-y-4">
        <input type="hidden" name="formAction" value="set-doi-custom-prefix" />
        <div className="flex items-center space-x-2">
          <ui.Checkbox
            id="doiCustomPrefixEnabled"
            name="doiCustomPrefixEnabled"
            value="doiCustomPrefixEnabled"
            defaultChecked={enabled}
            disabled={busy}
          />
          <label htmlFor="doiCustomPrefixEnabled" className="text-sm font-medium">
            Allow own DOI prefix (Enterprise)
          </label>
          <ui.TooltipProvider>
            <ui.Tooltip>
              <ui.TooltipTrigger asChild>
                <InfoIcon className="w-4 h-4 text-muted-foreground" />
              </ui.TooltipTrigger>
              <ui.TooltipContent sideOffset={5} className="max-w-sm bg-blue-600">
                <p className="text-blue-50">
                  Lets site admins register DOIs under their organization&apos;s Crossref prefix.
                  Turning this off does not change a Site that is already configured; it only hides
                  the option in the setup.
                </p>
                <ui.TooltipArrow className="fill-blue-600" />
              </ui.TooltipContent>
            </ui.Tooltip>
          </ui.TooltipProvider>
        </div>
        <div className="flex justify-end">
          <ui.StatefulButton type="submit" variant="default" busy={busy} overlayBusy>
            Save
          </ui.StatefulButton>
        </div>
      </fetcher.Form>
    </ui.Card>
  );
}
