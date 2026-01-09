import { withAppSiteContext, siteUploadsStage, siteUploadsComplete } from '@curvenote/scms-server';
import {
  PageFrame,
  clientCheckSiteScopes,
  site as siteScopes,
  coerceToObject,
  primitives,
  ui,
  getBrandingFromMetaMatches,
  joinPageTitle,
} from '@curvenote/scms-core';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import type { JournalThemeConfig, SiteDTO } from '@curvenote/common';
import { EditNavLinks } from './EditNavLinks.js';
import { EditCTAs } from './EditCTAs.js';
import type { Intents } from './types.js';
import { INTENTS } from './types.js';
import {
  $actionEditNavLinks,
  $actionEditCTAs,
  $actionEditLogo,
  $actionUpdateThemeColor,
} from './actionHelpers.server.js';
import { ExternalLinkIcon } from 'lucide-react';
import { SiteLogoUploadCard } from './SiteLogoUploadCard.js';
import type { FileUploadConfig } from '@curvenote/scms-core';
import { ThemeColorPicker } from './ThemeColorPicker.js';

interface LoaderData {
  scopes: string[];
  site: SiteDTO;
  metadata: any;
  logoUrl: string | undefined;
}

const logoUploadConfig: FileUploadConfig = {
  slot: 'logo',
  label: 'Site Logo',
  description: 'Upload a logo image for your site',
  optional: true,
  multiple: false,
  ignoreDuplicates: true,
  accept: 'image/*',
  mimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'],
  maxSize: 1 * 1024 * 1024,
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [siteScopes.update], {
    redirectTo: '/app',
    redirect: true,
  });

  const metadata = coerceToObject(ctx.site.metadata);
  const logoUrl = metadata?.logo as string | undefined;

  return {
    scopes: ctx.scopes,
    site: ctx.siteDTO,
    metadata: ctx.site.metadata,
    logoUrl,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Website & Design', loaderData?.site?.title, branding.title) }];
};

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.update]);

  const formData = await args.request.formData();
  const intent = String(formData.get('intent')) as Intents;
  const allowedIntents = Object.values(INTENTS) as Intents[];
  if (!allowedIntents.includes(intent)) {
    return data({ error: 'Invalid form action' }, { status: 400 });
  }

  if (intent === INTENTS.uploadStage) {
    console.log('uploadStage', formData);
    return siteUploadsStage(ctx, logoUploadConfig, formData);
  } else if (intent === INTENTS.uploadComplete) {
    return siteUploadsComplete(ctx, formData);
  } else if (intent === INTENTS.updateColor) {
    console.log('updateColor', formData);
    return $actionUpdateThemeColor(ctx, formData);
  } else if (intent.startsWith('logo.')) {
    return $actionEditLogo(ctx, formData);
  } else if (intent.startsWith('navlinks.')) {
    return $actionEditNavLinks(ctx, formData);
  } else {
    return $actionEditCTAs(ctx, formData);
  }
}

export default function WebsiteAndDesign({ loaderData }: { loaderData: LoaderData }) {
  const { scopes, site, metadata, logoUrl } = loaderData;

  const canEdit = clientCheckSiteScopes(scopes, [siteScopes.update], site.name);

  const themeConfig = coerceToObject(metadata)?.theme_config as JournalThemeConfig | undefined;
  const nav = themeConfig?.manifest?.nav ?? [];
  let ctas = themeConfig?.landing?.hero?.cta ?? [];
  if (!Array.isArray(ctas)) ctas = [ctas];

  const isCustomTheme = !themeConfig || themeConfig?.custom;

  return (
    <PageFrame
      title="Website & Design"
      subtitle={`Site-wide configuration options for ${site.title}`}
    >
      <primitives.Card lift className="px-6 py-4 space-y-4">
        <h2>Venue Name</h2>
        <p className="text-sm font-light">
          Use to identify your venue in the Curvenote App, CLI and API.
        </p>
        <div className="space-y-4">
          <ui.Input className="max-w-sm" disabled value={site.name} />
          <p className="font-mono text-xs">
            API:{' '}
            <a
              className="text-black underline dark:text-white"
              href={site.links.self}
              target="_blank"
            >
              {site.links.self}
            </a>
            <ExternalLinkIcon className="inline-block w-3 h-3 ml-[2px]" />
          </p>
        </div>
      </primitives.Card>
      <SiteLogoUploadCard siteName={site.name} currentLogoUrl={logoUrl} readonly={!canEdit} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <primitives.Card lift className="px-6 py-4 space-y-4">
          <h2>Primary Theme Color</h2>
          <p className="text-sm font-light">
            The primary color is used for key elements like buttons, links, and highlights
            throughout your site.
          </p>
          <ThemeColorPicker
            initialValue={themeConfig?.colors?.primary || '#3b82f6'}
            level="primary"
          />
        </primitives.Card>
        <primitives.Card lift className="px-6 py-4 space-y-4">
          <h2>Secondary Theme Color</h2>
          <p className="text-sm font-light">
            The secondary color provides contrast and is used for secondary actions and accents.
          </p>
          <ThemeColorPicker
            initialValue={
              themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b'
            }
            level="secondary"
          />
        </primitives.Card>
      </div>
      <div>
        {!isCustomTheme && <EditNavLinks nav={nav} canEdit={canEdit} />}
        {!isCustomTheme && <EditCTAs items={ctas} />}
      </div>
    </PageFrame>
  );
}
