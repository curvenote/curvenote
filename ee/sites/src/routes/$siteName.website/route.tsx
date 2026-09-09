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
import { UnsavedChangesGuard } from './UnsavedChangesGuard.js';
import { ImageIcon, PaletteIcon, TypeIcon } from 'lucide-react';
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
  faviconUrl: string | undefined;
  publicCdn?: string;
}

const faviconUploadConfig: FileUploadConfig = {
  slot: 'favicon',
  label: 'Favicon',
  description: 'Upload a favicon for your site',
  optional: true,
  multiple: false,
  ignoreDuplicates: true,
  accept: 'image/png,image/x-icon,image/svg+xml',
  mimeTypes: [
    'image/png',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/svg+xml',
    'image/webp',
  ],
  maxSize: 1 * 1024 * 1024,
};

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
  const faviconUrl = metadata?.favicon as string | undefined;

  return {
    scopes: ctx.scopes,
    site: ctx.siteDTO,
    themeConfig,
    logoUrl,
    logoDarkUrl,
    faviconUrl,
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
    const uploadConfig =
      formData.get('slot') === faviconUploadConfig.slot ? faviconUploadConfig : logoUploadConfig;
    return siteUploadsStage(ctx, uploadConfig, formData);
  } else if (intent === FILE_UPLOAD_INTENTS.uploadComplete) {
    return siteUploadsComplete(ctx, formData);
  } else if (intent === 'site.update') {
    return $actionUpdateSiteDesign(ctx, formData);
  }
  return null;
}

/** Hex colors round-trip through the picker in upper case, so compare case-insensitively. */
function sameColor(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function UnsavedDot() {
  return (
    <ui.SimpleTooltip title="Unsaved changes">
      <span role="status" aria-label="Unsaved changes" className="flex">
        <ui.Dot className="bg-amber-500" />
      </span>
    </ui.SimpleTooltip>
  );
}

export default function WebsiteAndDesign({ loaderData }: { loaderData: LoaderData }) {
  const { scopes, site, themeConfig, logoUrl, logoDarkUrl, faviconUrl, publicCdn } = loaderData;
  const fetcher = useFetcher();
  const toPublicAssetUrl = (uploadedPath: string) => {
    if (!publicCdn) return uploadedPath;
    return `${publicCdn.replace(/\/+$/, '')}/${uploadedPath.replace(/^\/+/, '')}`;
  };

  const [currentTitle, setCurrentTitle] = useState(site.title);
  const [currentDescription, setCurrentDescription] = useState(site.description || '');
  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl);
  const [currentLogoDarkUrl, setCurrentLogoDarkUrl] = useState(logoDarkUrl);
  const [currentFaviconUrl, setCurrentFaviconUrl] = useState(faviconUrl);
  const [currentColorPrimary, setCurrentColorPrimary] = useState(
    themeConfig?.colors?.primary || '#3b82f6',
  );
  const [currentColorSecondary, setCurrentColorSecondary] = useState(
    themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b',
  );
  // Use a reset key to force ColorPicker remounting on cancel
  const [resetKey, setResetKey] = useState(0);

  // Use refs to debounce color updates and prevent race conditions
  const primaryColorTimeoutRef = useRef<NodeJS.Timeout>();
  const secondaryColorTimeoutRef = useRef<NodeJS.Timeout>();

  const canEdit = clientCheckSiteScopes(scopes, [siteScopes.update], site.name);

  // Which accordion sections differ from what is saved, compared against the same
  // defaults the state is initialized with so an untouched page shows no indicators
  const basicsChanged =
    currentTitle !== site.title || currentDescription !== (site.description || '');
  const logosChanged =
    currentLogoUrl !== logoUrl ||
    currentLogoDarkUrl !== logoDarkUrl ||
    currentFaviconUrl !== faviconUrl;
  const colorsChanged =
    !sameColor(currentColorPrimary, themeConfig?.colors?.primary || '#3b82f6') ||
    !sameColor(
      currentColorSecondary,
      themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b',
    );
  // Derived rather than latched, so editing a value and putting it back is not dirty
  const dirty = basicsChanged || logosChanged || colorsChanged;

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
    setCurrentFaviconUrl(faviconUrl);
    setCurrentColorPrimary(themeConfig?.colors?.primary || '#3b82f6');
    setCurrentColorSecondary(
      themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b',
    );
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
    if (currentFaviconUrl && currentFaviconUrl !== faviconUrl) {
      formData.append('faviconUrl', currentFaviconUrl);
    }
    if (currentColorPrimary !== themeConfig?.colors?.primary) {
      formData.append('colorPrimary', currentColorPrimary);
    }
    if (currentColorSecondary !== themeConfig?.colors?.secondary) {
      formData.append('colorSecondary', currentColorSecondary);
    }

    fetcher.submit(formData, { method: 'POST' });
  };

  const handleReset = () => {
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
            if (hexColor !== currentColor) {
              setColor(hexColor);
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
            faviconUrl={currentFaviconUrl}
            themeColorPrimary={currentColorPrimary}
            themeColorSecondary={currentColorSecondary}
          />
        </div>
      </PageFrame>

      <div className="flex flex-col h-full bg-white shadow-sm dark:bg-slate-950 lg:sticky lg:top-0 lg:h-[calc(100vh-1.75rem)]">
        <h2 className="m-6 text-xl font-semibold shrink-0">Website & Design</h2>

        <div className="flex-1 min-h-0 overflow-auto">
          <ui.Accordion type="single" collapsible defaultValue="item-title" className="w-full">
            <ui.AccordionItem value="item-title">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-center flex-1 gap-3">
                  <TypeIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 font-semibold">
                      Basics
                      {basicsChanged && <UnsavedDot />}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ui.Label htmlFor="site-title">Title</ui.Label>
                      <ui.SimpleTooltipWithIcon title="The name of your site, shown in the site header and the browser tab." />
                    </div>
                    <ui.Input
                      id="site-title"
                      value={currentTitle}
                      onChange={(e) => {
                        setCurrentTitle(e.target.value);
                      }}
                      placeholder="Enter site title"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ui.Label htmlFor="site-description">Description</ui.Label>
                      <ui.SimpleTooltipWithIcon title="A short summary of the site, used by search engines and link previews." />
                    </div>
                    <ui.Input
                      id="site-description"
                      value={currentDescription}
                      onChange={(e) => {
                        setCurrentDescription(e.target.value);
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
                <div className="flex items-center flex-1 gap-3">
                  <ImageIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 font-semibold">
                      Logos
                      {logosChanged && <UnsavedDot />}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 space-y-4">
                  {/* Light Mode Logo */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium">Light Mode</h3>
                      <ui.SimpleTooltipWithIcon title="Logo shown in the site header on light backgrounds." />
                    </div>
                    <div className="flex items-start gap-4">
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
                      <div className="flex-1">
                        <FileDropzone
                          folder={`static/site/${site.name}`}
                          slot="logo"
                          readonly={!canEdit}
                          height="56px"
                          className="p-3"
                          inline
                          label="Upload logo"
                          onUploadComplete={(uploadedPath) => {
                            setCurrentLogoUrl(toPublicAssetUrl(uploadedPath));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dark Mode Logo */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium">Dark Mode</h3>
                      <ui.SimpleTooltipWithIcon title="Logo shown in the site header when a visitor is using dark mode." />
                    </div>
                    <div className="flex items-start gap-4">
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
                      <div className="flex-1">
                        <FileDropzone
                          folder={`static/site/${site.name}`}
                          slot="logo"
                          readonly={!canEdit}
                          height="56px"
                          className="p-3"
                          inline
                          label="Upload dark logo"
                          onUploadComplete={(uploadedPath) => {
                            setCurrentLogoDarkUrl(toPublicAssetUrl(uploadedPath));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Favicon */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium">Favicon</h3>
                      <ui.SimpleTooltipWithIcon title="Small icon shown in the browser tab and in bookmarks." />
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center flex-shrink-0 w-20 h-20">
                        {currentFaviconUrl ? (
                          <img
                            src={currentFaviconUrl}
                            alt="Favicon"
                            className="object-contain w-8 h-8 rounded"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-20 h-20 border rounded bg-muted">
                            <span className="text-xs text-muted-foreground">No favicon</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <FileDropzone
                          folder={`static/site/${site.name}`}
                          slot="favicon"
                          readonly={!canEdit}
                          height="56px"
                          className="p-3"
                          inline
                          label="Upload favicon"
                          accept={{ 'image/png': [], 'image/x-icon': [], 'image/svg+xml': [] }}
                          onUploadComplete={(uploadedPath) => {
                            setCurrentFaviconUrl(toPublicAssetUrl(uploadedPath));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </ui.AccordionContent>
            </ui.AccordionItem>

            <ui.AccordionItem value="item-colors">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-center flex-1 gap-3">
                  <PaletteIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 font-semibold">
                      Colors
                      {colorsChanged && <UnsavedDot />}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ui.Label>Primary Color</ui.Label>
                      <ui.SimpleTooltipWithIcon title="Your main brand color, used for the site banner and footer." />
                    </div>
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
                    <div className="flex items-center gap-1.5">
                      <ui.Label>Secondary Color</ui.Label>
                      <ui.SimpleTooltipWithIcon title="Accent color, used for buttons and highlights on the site." />
                    </div>
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
                <div className="flex items-center flex-1 gap-3">
                  <LinkIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
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

        {/* Save/Reset Buttons */}
        <div className="p-4 bg-white border-t dark:bg-slate-950">
          <div className="flex justify-end gap-2">
            <ui.Button variant="outline" onClick={handleReset} disabled={!dirty || !canEdit}>
              Reset
            </ui.Button>
            <ui.Button onClick={handleSave} disabled={!dirty || !canEdit}>
              Save Changes
            </ui.Button>
          </div>
        </div>
      </div>

      <UnsavedChangesGuard
        dirty={dirty}
        fetcher={fetcher}
        canSave={canEdit}
        description="You have unsaved changes to this site's design. Would you like to save them before leaving this page?"
        onSave={handleSave}
        onDiscard={resetFromLoaderData}
      />
    </div>
  );
}
