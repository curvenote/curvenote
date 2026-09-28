import { useState } from 'react';
import { useFetcher } from 'react-router';
import { ui, primitives } from '@curvenote/scms-core';
import { InfoIcon } from 'lucide-react';
import type { SiteDTO } from '@curvenote/common';
import type { SiteWithAppData } from '../../backend/db.server.js';

export function SiteSettingsForm({
  site,
  siteWithAppData,
}: {
  site: SiteDTO;
  siteWithAppData: SiteWithAppData;
}) {
  const fetcher = useFetcher<{ error?: string; info?: string }>();
  const saved = {
    title: site.title ?? '',
    description: site.description ?? '',
    private: !!site.private,
    magicLinksEnabled: siteWithAppData.data?.magicLinksEnabled ?? false,
  };
  const [title, setTitle] = useState(saved.title);
  const [description, setDescription] = useState(saved.description);
  const [isPrivate, setIsPrivate] = useState(saved.private);
  const [magicLinksEnabled, setMagicLinksEnabled] = useState(saved.magicLinksEnabled);
  const dirty =
    title !== saved.title ||
    description !== saved.description ||
    isPrivate !== saved.private ||
    magicLinksEnabled !== saved.magicLinksEnabled;
  const busy = fetcher.state === 'submitting';

  const handleReset = () => {
    setTitle(saved.title);
    setDescription(saved.description);
    setIsPrivate(saved.private);
    setMagicLinksEnabled(saved.magicLinksEnabled);
  };

  return (
    <primitives.Card lift className="max-w-4xl px-6 py-4 space-y-4" validateUsing={fetcher}>
      <h2>Site Settings</h2>
      <p className="text-sm font-light">Configure core settings for your site.</p>

      <fetcher.Form method="POST" className="m-0 space-y-4">
        <input type="hidden" name="formAction" value="update-site-settings" />
        <input type="hidden" name="siteId" value={site.id} />

        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium">
            Site Title
          </label>
          <ui.Input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter site title"
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-medium">
            Description
          </label>
          <ui.Textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter site description"
            disabled={busy}
          />
        </div>

        <div className="flex items-center space-x-2">
          <ui.Checkbox
            id="private"
            name="private"
            value="private"
            checked={isPrivate}
            onCheckedChange={(checked) => setIsPrivate(checked === true)}
            disabled={busy}
          />
          <label htmlFor="private" className="text-sm font-medium">
            Private site
          </label>
          <ui.TooltipProvider>
            <ui.Tooltip>
              <ui.TooltipTrigger asChild>
                <InfoIcon className="w-4 h-4 text-muted-foreground" />
              </ui.TooltipTrigger>
              <ui.TooltipContent sideOffset={5} className="max-w-sm bg-blue-600">
                <p className="text-blue-50">
                  Private sites are only accessible to site members. The private site setting needs
                  to be set in conjunction with the correct theme_config.secure and
                  theme_config.default_workflow options in addition to each collection having the
                  appropriate workflow.
                </p>
                <ui.TooltipArrow className="fill-blue-600" />
              </ui.TooltipContent>
            </ui.Tooltip>
          </ui.TooltipProvider>
        </div>

        <div className="flex items-center space-x-2">
          <ui.Checkbox
            id="magicLinksEnabled"
            name="magicLinksEnabled"
            value="magicLinksEnabled"
            checked={magicLinksEnabled}
            onCheckedChange={(checked) => setMagicLinksEnabled(checked === true)}
            disabled={busy}
          />
          <label htmlFor="magicLinksEnabled" className="text-sm font-medium">
            Enable Access Links (Magic Links)
          </label>
          <ui.TooltipProvider>
            <ui.Tooltip>
              <ui.TooltipTrigger asChild>
                <InfoIcon className="w-4 h-4 text-muted-foreground" />
              </ui.TooltipTrigger>
              <ui.TooltipContent sideOffset={5} className="max-w-sm bg-blue-600">
                <p className="text-blue-50">
                  Enable the creation of secure, time-limited magic links for sharing submissions
                  with reviewers or collaborators. When disabled, the Access Links UI will be hidden
                  from submission detail pages.
                </p>
                <ui.TooltipArrow className="fill-blue-600" />
              </ui.TooltipContent>
            </ui.Tooltip>
          </ui.TooltipProvider>
        </div>

        <div className="flex justify-end space-x-3">
          <ui.Button
            type="button"
            variant="secondary"
            disabled={!dirty || busy}
            onClick={handleReset}
          >
            Reset
          </ui.Button>
          <ui.Button type="submit" disabled={!dirty || busy} variant="default">
            {busy ? 'Saving...' : 'Save'}
          </ui.Button>
        </div>
      </fetcher.Form>
    </primitives.Card>
  );
}
