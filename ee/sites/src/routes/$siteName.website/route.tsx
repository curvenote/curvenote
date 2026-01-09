import { withAppSiteContext, siteUploadsStage, siteUploadsComplete } from '@curvenote/scms-server';
import {
  PageFrame,
  clientCheckSiteScopes,
  site as siteScopes,
  coerceToObject,
  getBrandingFromMetaMatches,
  joinPageTitle,
  ui,
  FILE_UPLOAD_INTENTS,
  FileDropzone,
} from '@curvenote/scms-core';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useFetcher } from 'react-router';
import type { JournalThemeConfig, SiteDTO } from '@curvenote/common';
import { SiteSkeleton } from './SiteSkeleton.js';
import { ImageIcon, PaletteIcon, Pencil } from 'lucide-react';
import { ClassicDesignRedirect } from './ClassicWebsiteRedirect.js';
import { useState, useRef, useCallback } from 'react';
import Color from 'color';
import { ColorSwatch } from './ColorSwatch.js';
import { $actionUpdateSiteDesign } from './actionHelpers.server.js';
import type { FileUploadConfig } from '@curvenote/scms-core';

interface LoaderData {
  scopes: string[];
  site: SiteDTO;
  themeConfig: JournalThemeConfig | undefined;
  logoUrl: string | undefined;
  logoDarkUrl: string | undefined;
  publicCdn?: string;
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

  const metadata = coerceToObject(ctx.site.metadata) as any;
  const themeConfig = metadata?.theme_config as JournalThemeConfig | undefined;
  const logoUrl = metadata?.logo as string | undefined;
  const logoDarkUrl = metadata?.logo_dark as string | undefined;

  return {
    scopes: ctx.scopes,
    site: ctx.siteDTO,
    themeConfig,
    logoUrl,
    logoDarkUrl,
    publicCdn: ctx.$config.api.knownBucketInfoMap.pub.cdn,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Website & Design', loaderData?.site?.title, branding.title) }];
};

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [siteScopes.update]);
  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;
  if (intent === FILE_UPLOAD_INTENTS.uploadStage) {
    return siteUploadsStage(ctx, logoUploadConfig, formData);
  } else if (intent === FILE_UPLOAD_INTENTS.uploadComplete) {
    return siteUploadsComplete(ctx, formData);
  } else if (intent === 'site.update') {
    return $actionUpdateSiteDesign(ctx, formData);
  }
  return null;
}

export default function WebsiteAndDesign({ loaderData }: { loaderData: LoaderData }) {
  const { scopes, site, themeConfig, logoUrl, logoDarkUrl, publicCdn } = loaderData;
  const fetcher = useFetcher();

  const [currentTitle, setCurrentTitle] = useState(site.title);
  const [currentDescription, setCurrentDescription] = useState(site.description || '');
  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl);
  const [currentLogoDarkUrl, setCurrentLogoDarkUrl] = useState(logoDarkUrl);
  const [currentColorPrimary, setCurrentColorPrimary] = useState(
    themeConfig?.colors?.primary || '#3b82f6',
  );
  const [currentColorSecondary, setCurrentColorSecondary] = useState(
    themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b',
  );
  const [dirty, setDirty] = useState(false);
  // Use a reset key to force ColorPicker remounting on cancel
  const [resetKey, setResetKey] = useState(0);

  // Use refs to debounce color updates and prevent race conditions
  const primaryColorTimeoutRef = useRef<NodeJS.Timeout>();
  const secondaryColorTimeoutRef = useRef<NodeJS.Timeout>();

  const canEdit = clientCheckSiteScopes(scopes, [siteScopes.update], site.name);

  // Reset state from loader data
  const resetFromLoaderData = () => {
    // Clear any pending color updates
    if (primaryColorTimeoutRef.current) {
      clearTimeout(primaryColorTimeoutRef.current);
    }
    if (secondaryColorTimeoutRef.current) {
      clearTimeout(secondaryColorTimeoutRef.current);
    }

    setCurrentTitle(site.title);
    setCurrentDescription(site.description || '');
    setCurrentLogoUrl(logoUrl);
    setCurrentLogoDarkUrl(logoDarkUrl);
    setCurrentColorPrimary(themeConfig?.colors?.primary || '#3b82f6');
    setCurrentColorSecondary(
      themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b',
    );
    setDirty(false);
    // Force ColorPicker to remount with original values
    setResetKey((prev) => prev + 1);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append('intent', 'site.update');
    if (currentTitle !== site.title) {
      formData.append('title', currentTitle);
    }
    if (currentDescription !== site.description) {
      formData.append('description', currentDescription);
    }
    if (currentLogoUrl && currentLogoUrl !== logoUrl) {
      formData.append('logoUrl', currentLogoUrl);
    }
    if (currentLogoDarkUrl && currentLogoDarkUrl !== logoDarkUrl) {
      formData.append('logoDarkUrl', currentLogoDarkUrl);
    }
    if (currentColorPrimary !== themeConfig?.colors?.primary) {
      formData.append('colorPrimary', currentColorPrimary);
    }
    if (currentColorSecondary !== themeConfig?.colors?.secondary) {
      formData.append('colorSecondary', currentColorSecondary);
    }

    fetcher.submit(formData, { method: 'POST' });
    setDirty(false);
  };

  const handleCancel = () => {
    resetFromLoaderData();
  };

  // Generic debounced color change handler to prevent race conditions
  const colorChangeHandler = useCallback(
    (
      setColor: (color: string) => void,
      currentColor: string,
      timeoutRef: React.MutableRefObject<NodeJS.Timeout | undefined>,
    ): ui.ColorPickerProps['onChange'] => {
      return (rgb: Parameters<NonNullable<ui.ColorPickerProps['onChange']>>[0]) => {
        if (Array.isArray(rgb) && typeof rgb[0] === 'number') {
          const color = Color.rgb(rgb[0], rgb[1], rgb[2]);
          const hexColor = color.hex();

          // Clear existing timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          // Debounce the state update to prevent race conditions
          timeoutRef.current = setTimeout(() => {
            // Only set dirty if the color actually changed
            if (hexColor !== currentColor) {
              setColor(hexColor);
              setDirty(true);
            }
          }, 16); // ~60fps update rate
        }
      };
    },
    [],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3">
      <PageFrame className="lg:col-span-2">
        <div className="space-y-4">
          <SiteSkeleton
            site={{ ...site, title: currentTitle }}
            logoUrl={currentLogoUrl}
            logoDarkUrl={currentLogoDarkUrl}
            themeColorPrimary={currentColorPrimary}
            themeColorSecondary={currentColorSecondary}
          />
          <ClassicDesignRedirect siteName={site.name} />
        </div>
      </PageFrame>

      <div className="flex flex-col h-full bg-white shadow-sm dark:bg-slate-950">
        <h2 className="m-6 text-xl font-semibold">Website & Design</h2>

        <div className="flex-1 overflow-auto">
          <ui.Accordion type="single" collapsible defaultValue="item-title" className="w-full">
            <ui.AccordionItem value="item-title">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-start flex-1 gap-3">
                  <Pencil className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Basics</div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 space-y-4">
                  <div className="space-y-2">
                    <ui.Label htmlFor="site-title">Title</ui.Label>
                    <ui.Input
                      id="site-title"
                      value={currentTitle}
                      onChange={(e) => {
                        setCurrentTitle(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Enter site title"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <ui.Label htmlFor="site-description">Description</ui.Label>
                    <ui.Input
                      id="site-description"
                      value={currentDescription}
                      onChange={(e) => {
                        setCurrentDescription(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Enter site description"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </ui.AccordionContent>
            </ui.AccordionItem>

            <ui.AccordionItem value="item-logos">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-start flex-1 gap-3">
                  <ImageIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Logos</div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 space-y-4">
                  {/* Light Mode Logo */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-start gap-2">
                      <h3 className="text-sm font-medium">Light Mode</h3>
                      <div className="flex items-center justify-center flex-shrink-0 w-20 h-20">
                        {currentLogoUrl ? (
                          <img
                            src={currentLogoUrl}
                            alt="Light mode logo"
                            className="object-contain w-20 h-20 rounded"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-20 h-20 border rounded bg-muted">
                            <span className="text-xs text-muted-foreground">No logo</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <FileDropzone
                        folder={`static/site/${site.name}`}
                        slot="logo"
                        readonly={!canEdit}
                        height="80px"
                        onUploadComplete={(uploadedPath) => {
                          setCurrentLogoUrl(`${publicCdn}/${uploadedPath}`);
                          setDirty(true);
                        }}
                      />
                    </div>
                  </div>

                  {/* Dark Mode Logo */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-start gap-2">
                      <h3 className="text-sm font-medium">Dark Mode</h3>
                      <div className="flex items-center justify-center flex-shrink-0 w-20 h-20 rounded bg-slate-900">
                        {currentLogoDarkUrl ? (
                          <img
                            src={currentLogoDarkUrl}
                            alt="Dark mode logo"
                            className="object-contain w-20 h-20 rounded"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-20 h-20">
                            <span className="text-xs text-slate-400">No logo</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <FileDropzone
                        folder={`static/site/${site.name}`}
                        slot="logo"
                        readonly={!canEdit}
                        height="80px"
                        onUploadComplete={(uploadedPath) => {
                          setCurrentLogoDarkUrl(`${publicCdn}/${uploadedPath}`);
                          setDirty(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </ui.AccordionContent>
            </ui.AccordionItem>

            <ui.AccordionItem value="item-colors">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-start flex-1 gap-3">
                  <PaletteIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Colors</div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 space-y-6">
                  <div className="space-y-2">
                    <ui.Label>Primary Color</ui.Label>
                    <ui.ColorPicker
                      key={`primary-${resetKey}`}
                      defaultValue={currentColorPrimary}
                      onChange={colorChangeHandler(
                        setCurrentColorPrimary,
                        currentColorPrimary,
                        primaryColorTimeoutRef,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ColorSwatch />
                        <ui.ColorPickerFormat className="flex-1" />
                        <ui.ColorPickerOutput />
                      </div>
                    </ui.ColorPicker>
                  </div>

                  <div className="space-y-2">
                    <ui.Label>Secondary Color</ui.Label>
                    <ui.ColorPicker
                      key={`secondary-${resetKey}`}
                      defaultValue={currentColorSecondary}
                      onChange={colorChangeHandler(
                        setCurrentColorSecondary,
                        currentColorSecondary,
                        secondaryColorTimeoutRef,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ColorSwatch />
                        <ui.ColorPickerFormat className="flex-1" />
                        <ui.ColorPickerOutput />
                      </div>
                    </ui.ColorPicker>
                  </div>
                </div>
              </ui.AccordionContent>
            </ui.AccordionItem>

            {/* <AccordionItem value="item-navigation">
              <AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-start flex-1 gap-3">
                  <LinkIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Navigation Links</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-4">
                  <p className="text-sm text-muted-foreground">
                    Navigation configuration coming soon...
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem> */}
          </ui.Accordion>
        </div>

        {/* Save/Cancel Buttons */}
        <div className="p-4 bg-white border-t dark:bg-slate-950">
          <div className="flex justify-end gap-2">
            <ui.Button variant="outline" onClick={handleCancel} disabled={!dirty || !canEdit}>
              Cancel
            </ui.Button>
            <ui.Button onClick={handleSave} disabled={!dirty || !canEdit}>
              Save Changes
            </ui.Button>
          </div>
        </div>
      </div>
    </div>
  );
}
