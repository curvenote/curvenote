import { withAppSiteContext, siteUploadsStage, siteUploadsComplete } from '@curvenote/scms-server';
import {
  PageFrame,
  clientCheckSiteScopes,
  site as siteScopes,
  coerceToObject,
  getBrandingFromMetaMatches,
  joinPageTitle,
  ui,
  cn,
  FILE_UPLOAD_INTENTS,
  FileDropzone,
} from '@curvenote/scms-core';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useFetcher } from 'react-router';
import type { SiteDTO } from '@curvenote/common';
import type { FontLicense, SiteThemeConfig, ThemeFontsConfig } from '../../themeConfig/types.js';
import { fontLicenseError, fontsError } from '../../themeConfig/validate.js';
import {
  FONT_LICENSE_UPLOAD_SLOT,
  FONT_UPLOAD_SLOT,
  LICENSE_MAX_BYTES,
  TypographyField,
} from './TypographyField.js';
import { SiteSkeleton } from './SiteSkeleton.js';
import { ERROR_TOOLTIP_CLASS, UnsavedChangesGuard } from './UnsavedChangesGuard.js';
import { SocialLinksField, socialLinksError } from './SocialLinksField.js';
import { FooterLinksField, footerLinksError } from './FooterLinksField.js';
import { DESIGN_TARGETS, type DesignTarget } from './designTargets.js';
import {
  CaseSensitive,
  ImageIcon,
  PaletteIcon,
  PanelBottomIcon,
  TriangleAlert,
  TypeIcon,
} from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import Color from 'color';
import { ColorSwatch } from './ColorSwatch.js';
import { $actionUpdateSiteDesign } from './actionHelpers.server.js';
import type { FileUploadConfig } from '@curvenote/scms-core';

interface LoaderData {
  scopes: string[];
  site: SiteDTO;
  themeConfig: SiteThemeConfig | undefined;
  logoUrl: string | undefined;
  logoDarkUrl: string | undefined;
  faviconUrl: string | undefined;
  footerLogoUrl: string | undefined;
  footerLogoDarkUrl: string | undefined;
  tagline: string | undefined;
  fontLicense: FontLicense | undefined;
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

const fontUploadConfig: FileUploadConfig = {
  slot: FONT_UPLOAD_SLOT,
  label: 'Font file',
  description: 'Upload a web font file for your site',
  optional: true,
  multiple: false,
  ignoreDuplicates: true,
  accept: '.woff2,.woff,.otf,.ttf',
  mimeTypes: [
    'font/woff2',
    'font/woff',
    'font/otf',
    'font/ttf',
    'application/font-woff2',
    'application/font-woff',
    'application/x-font-otf',
    'application/x-font-ttf',
    'application/octet-stream',
  ],
  maxSize: 2 * 1024 * 1024,
};

const fontLicenseUploadConfig: FileUploadConfig = {
  slot: FONT_LICENSE_UPLOAD_SLOT,
  label: 'Font license',
  description: 'Upload a font license or receipt',
  optional: true,
  multiple: false,
  ignoreDuplicates: true,
  accept: '.pdf,.txt,.md,.png,.jpg,.jpeg,.webp',
  mimeTypes: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ],
  maxSize: LICENSE_MAX_BYTES,
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
  const themeConfig = metadata?.theme_config as SiteThemeConfig | undefined;
  const logoUrl = metadata?.logo as string | undefined;
  const logoDarkUrl = metadata?.logo_dark as string | undefined;
  const faviconUrl = metadata?.favicon as string | undefined;
  const footerLogoUrl = metadata?.footer_logo as string | undefined;
  const footerLogoDarkUrl = metadata?.footer_logo_dark as string | undefined;
  const tagline = metadata?.tagline as string | undefined;
  const fontLicense = metadata?.font_license as FontLicense | undefined;

  return {
    scopes: ctx.scopes,
    site: ctx.siteDTO,
    themeConfig,
    logoUrl,
    logoDarkUrl,
    faviconUrl,
    footerLogoUrl,
    footerLogoDarkUrl,
    tagline,
    fontLicense,
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
    const slot = formData.get('slot');
    const uploadConfig =
      slot === faviconUploadConfig.slot
        ? faviconUploadConfig
        : slot === fontUploadConfig.slot
          ? fontUploadConfig
          : slot === fontLicenseUploadConfig.slot
            ? fontLicenseUploadConfig
            : logoUploadConfig;
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

/** Lower the first letter, so a standalone message can be continued mid-sentence. */
function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Section indicator: amber for unsaved edits, red when something needs fixing. */
function SectionDot({ error }: { error?: string }) {
  const label = error ?? 'Unsaved changes';
  return (
    <ui.SimpleTooltip title={label} className="max-w-xs text-left">
      <span role="status" aria-label={label} className="flex">
        <ui.Dot className={error ? 'bg-red-500' : 'bg-amber-500'} />
      </span>
    </ui.SimpleTooltip>
  );
}

/** A field label with its info tooltip, kept on one centred line. */
/** A field's wrapper: carries the id a preview hotspot jumps to, and flashes when it lands. */
function Field({
  id,
  highlighted,
  className,
  children,
}: {
  id: string;
  highlighted?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-xs transition-shadow duration-500',
        highlighted === id &&
          'ring-2 ring-sky-500/70 ring-offset-4 ring-offset-white dark:ring-offset-slate-950',
        className,
      )}
    >
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  title,
  error,
  children,
}: {
  htmlFor?: string;
  title: string;
  /** Shown as a red warning beside the label when the field needs fixing. */
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <ui.Label htmlFor={htmlFor}>{children}</ui.Label>
      <ui.SimpleTooltipWithIcon title={title} />
      {error && (
        <ui.SimpleTooltip title={error} className="max-w-xs text-left">
          <span className="flex" role="img" aria-label={error}>
            <TriangleAlert className="w-4 h-4 text-red-600" />
          </span>
        </ui.SimpleTooltip>
      )}
    </div>
  );
}

export default function WebsiteAndDesign({ loaderData }: { loaderData: LoaderData }) {
  const {
    scopes,
    site,
    themeConfig,
    logoUrl,
    logoDarkUrl,
    faviconUrl,
    footerLogoUrl,
    footerLogoDarkUrl,
    tagline,
    fontLicense,
    publicCdn,
  } = loaderData;
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
  const [currentFooterLogoUrl, setCurrentFooterLogoUrl] = useState(footerLogoUrl);
  const [currentFooterLogoDarkUrl, setCurrentFooterLogoDarkUrl] = useState(footerLogoDarkUrl);
  const [currentTagline, setCurrentTagline] = useState(tagline || '');
  const [currentSocialLinks, setCurrentSocialLinks] = useState(site.social_links ?? []);
  const [currentFooterLinks, setCurrentFooterLinks] = useState(site.footer_links ?? []);
  const [currentColorPrimary, setCurrentColorPrimary] = useState(
    themeConfig?.colors?.primary || '#3b82f6',
  );
  const [currentColorSecondary, setCurrentColorSecondary] = useState(
    themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b',
  );
  // Slots absent from the saved config are "default"; the editor keeps that shape
  const savedFonts: ThemeFontsConfig = themeConfig?.fonts ?? {};
  const [currentFonts, setCurrentFonts] = useState<ThemeFontsConfig>(savedFonts);
  const savedLicense: FontLicense = fontLicense ?? {};
  const [currentLicense, setCurrentLicense] = useState<FontLicense>(savedLicense);
  // Use a reset key to force ColorPicker remounting on cancel
  const [resetKey, setResetKey] = useState(0);

  const licenseSubmittedRef = useRef(false);
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
  const footerChanged =
    currentFooterLogoUrl !== footerLogoUrl ||
    currentFooterLogoDarkUrl !== footerLogoDarkUrl ||
    currentTagline !== (tagline || '') ||
    JSON.stringify(currentSocialLinks) !== JSON.stringify(site.social_links ?? []) ||
    JSON.stringify(currentFooterLinks) !== JSON.stringify(site.footer_links ?? []);
  const fontsChanged = JSON.stringify(currentFonts) !== JSON.stringify(savedFonts);
  const licenseChanged = JSON.stringify(currentLicense) !== JSON.stringify(savedLicense);
  const dirty =
    basicsChanged ||
    logosChanged ||
    colorsChanged ||
    footerChanged ||
    fontsChanged ||
    licenseChanged;
  const fontsProblem = fontsError(currentFonts);
  const licenseProblem = fontLicenseError(currentFonts, currentLicense);
  const footerLinksProblem = footerLinksError(currentFooterLinks);
  const socialLinksProblem = socialLinksError(currentSocialLinks);
  // Field messages stand alone, so name the field they came from when they travel
  const footerSectionError =
    [
      socialLinksProblem && `In Social Links, ${lowerFirst(socialLinksProblem)}`,
      footerLinksProblem && `In Footer Links, ${lowerFirst(footerLinksProblem)}`,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const typographyProblem = [fontsProblem, licenseProblem].filter(Boolean).join(' ') || undefined;
  const typographySectionError =
    typographyProblem && `In Typography, ${lowerFirst(typographyProblem)}`;
  const sectionErrors = [typographySectionError, footerSectionError].filter(Boolean).join(' ');
  const saveError = sectionErrors
    ? `Form has errors that need to be fixed before saving. ${sectionErrors}`
    : undefined;
  const canSave = canEdit && !saveError;

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
    setCurrentFooterLogoUrl(footerLogoUrl);
    setCurrentFooterLogoDarkUrl(footerLogoDarkUrl);
    setCurrentTagline(tagline || '');
    setCurrentSocialLinks(site.social_links ?? []);
    setCurrentFooterLinks(site.footer_links ?? []);
    setCurrentColorPrimary(themeConfig?.colors?.primary || '#3b82f6');
    setCurrentColorSecondary(
      themeConfig?.colors?.secondary || themeConfig?.colors?.primary || '#64748b',
    );
    setCurrentFonts(savedFonts);
    setCurrentLicense(savedLicense);
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
    if (currentFooterLogoUrl && currentFooterLogoUrl !== footerLogoUrl) {
      formData.append('footerLogoUrl', currentFooterLogoUrl);
    }
    if (currentFooterLogoDarkUrl && currentFooterLogoDarkUrl !== footerLogoDarkUrl) {
      formData.append('footerLogoDarkUrl', currentFooterLogoDarkUrl);
    }
    if (currentTagline !== (tagline || '')) {
      formData.append('tagline', currentTagline);
    }
    if (JSON.stringify(currentSocialLinks) !== JSON.stringify(site.social_links ?? [])) {
      formData.append('socialLinks', JSON.stringify(currentSocialLinks));
    }
    if (JSON.stringify(currentFooterLinks) !== JSON.stringify(site.footer_links ?? [])) {
      formData.append('footerLinks', JSON.stringify(currentFooterLinks));
    }
    if (currentColorPrimary !== themeConfig?.colors?.primary) {
      formData.append('colorPrimary', currentColorPrimary);
    }
    if (currentColorSecondary !== themeConfig?.colors?.secondary) {
      formData.append('colorSecondary', currentColorSecondary);
    }
    if (JSON.stringify(currentFonts) !== JSON.stringify(savedFonts)) {
      formData.append('fonts', JSON.stringify(currentFonts));
    }
    if (licenseChanged) {
      formData.append('fontLicense', JSON.stringify(currentLicense));
      // Remembered so the success toast can say what happens next
      licenseSubmittedRef.current = !!currentLicense.files?.length && !savedLicense.verified;
    } else {
      licenseSubmittedRef.current = false;
    }

    fetcher.submit(formData, { method: 'POST' });
  };

  const handleReset = () => {
    resetFromLoaderData();
  };

  // Clicking a region of the preview opens its section, then scrolls to and flashes its field
  const [openSection, setOpenSection] = useState('item-title');
  const [pendingTarget, setPendingTarget] = useState<DesignTarget>();
  const [highlighted, setHighlighted] = useState<string>();

  const jumpTo = (target: DesignTarget) => {
    setOpenSection(DESIGN_TARGETS[target].section);
    setPendingTarget(target);
  };

  useEffect(() => {
    if (!pendingTarget) return;
    const { fieldId } = DESIGN_TARGETS[pendingTarget];
    const field = document.getElementById(fieldId);
    // The section's content mounts on the render after it opens; try again then
    if (!field) return;
    // Let the accordion finish expanding before measuring where to scroll
    const timer = setTimeout(() => {
      field.scrollIntoView({ block: 'center', behavior: 'smooth' });
      field.querySelector<HTMLElement>('input:not([type="file"])')?.focus({ preventScroll: true });
      setHighlighted(fieldId);
      setPendingTarget(undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [pendingTarget, openSection]);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(undefined), 1500);
    return () => clearTimeout(timer);
  }, [highlighted]);

  // Report how the save went
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    const data = fetcher.data as { success?: boolean; error?: string };
    if (data.error) ui.toastError(data.error);
    else if (data.success)
      ui.toastSuccess(
        licenseSubmittedRef.current
          ? 'Site design saved. The font license is awaiting verification.'
          : 'Site design saved',
      );
  }, [fetcher.state, fetcher.data]);

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
            footerLogoUrl={currentFooterLogoUrl}
            footerLogoDarkUrl={currentFooterLogoDarkUrl}
            tagline={currentTagline}
            social={currentSocialLinks}
            footerLinks={currentFooterLinks}
            themeColorPrimary={currentColorPrimary}
            themeColorSecondary={currentColorSecondary}
            fonts={currentFonts}
            onSelect={jumpTo}
          />
        </div>
      </PageFrame>

      <div className="flex flex-col h-full bg-white shadow-sm dark:bg-slate-950 lg:sticky lg:top-0 lg:h-[calc(100vh-1.75rem)]">
        <h2 className="p-6 text-xl font-semibold border-b shrink-0">Website & Design</h2>

        <div className="flex-1 min-h-0 overflow-auto">
          <ui.Accordion
            type="single"
            collapsible
            value={openSection}
            onValueChange={setOpenSection}
            className="w-full"
          >
            <ui.AccordionItem value="item-title">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-center flex-1 gap-3">
                  <TypeIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 font-semibold">
                      Basics
                      {basicsChanged && <SectionDot />}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 pt-2 space-y-4">
                  <Field id="field-title" highlighted={highlighted} className="space-y-2">
                    <FieldLabel
                      htmlFor="site-title"
                      title="The name of your site, shown in the site header and the browser tab."
                    >
                      Title
                    </FieldLabel>
                    <ui.Input
                      id="site-title"
                      value={currentTitle}
                      onChange={(e) => {
                        setCurrentTitle(e.target.value);
                      }}
                      placeholder="Enter site title"
                      disabled={!canEdit}
                    />
                  </Field>
                  <div className="space-y-2">
                    <FieldLabel
                      htmlFor="site-description"
                      title="A short summary of the site, used by search engines and link previews."
                    >
                      Description
                    </FieldLabel>
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
                      {logosChanged && <SectionDot />}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 pt-2 space-y-4">
                  {/* Light Mode Logo */}
                  <Field id="field-logo" highlighted={highlighted} className="space-y-2">
                    <FieldLabel title="Logo shown in the site header on light backgrounds.">
                      Light Mode
                    </FieldLabel>
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
                  </Field>

                  {/* Dark Mode Logo */}
                  <Field id="field-logo-dark" highlighted={highlighted} className="space-y-2">
                    <FieldLabel title="Logo shown in the site header when a visitor is using dark mode.">
                      Dark Mode
                    </FieldLabel>
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
                  </Field>

                  {/* Favicon */}
                  <Field id="field-favicon" highlighted={highlighted} className="space-y-2">
                    <FieldLabel title="Small icon shown in the browser tab and in bookmarks.">
                      Favicon
                    </FieldLabel>
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
                  </Field>
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
                      {colorsChanged && <SectionDot />}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 pt-2 space-y-6">
                  <Field id="field-color-primary" highlighted={highlighted} className="space-y-2">
                    <FieldLabel title="Your main brand color, used for the site banner and footer.">
                      Primary Color
                    </FieldLabel>
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
                  </Field>

                  <Field id="field-color-secondary" highlighted={highlighted} className="space-y-2">
                    <FieldLabel title="Accent color, used for buttons and highlights on the site.">
                      Secondary Color
                    </FieldLabel>
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
                  </Field>
                </div>
              </ui.AccordionContent>
            </ui.AccordionItem>

            <ui.AccordionItem value="item-typography">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-center flex-1 gap-3">
                  <CaseSensitive className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 font-semibold">
                      Typography
                      {(fontsChanged || licenseChanged || typographySectionError) && (
                        <SectionDot error={typographySectionError || undefined} />
                      )}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 pt-2 space-y-4">
                  <Field id="field-fonts" highlighted={highlighted} className="space-y-2">
                    <FieldLabel
                      title="Fonts for article text. Site navigation and buttons keep the system font so they never look foreign."
                      error={typographyProblem}
                    >
                      Fonts
                    </FieldLabel>
                    <TypographyField
                      fonts={currentFonts}
                      savedFonts={savedFonts}
                      onChange={setCurrentFonts}
                      license={currentLicense}
                      savedLicense={savedLicense}
                      licenseError={licenseProblem}
                      onLicenseChange={setCurrentLicense}
                      disabled={!canEdit}
                      uploadFolder={`static/site/${site.name}`}
                      toPublicUrl={toPublicAssetUrl}
                      openSlot={
                        pendingTarget?.startsWith('fonts.')
                          ? (pendingTarget.slice('fonts.'.length) as 'body' | 'heading' | 'small')
                          : undefined
                      }
                    />
                  </Field>
                </div>
              </ui.AccordionContent>
            </ui.AccordionItem>

            <ui.AccordionItem value="item-footer">
              <ui.AccordionTrigger className="justify-between px-4 hover:no-underline">
                <div className="flex items-center flex-1 gap-3">
                  <PanelBottomIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 font-semibold">
                      Footer
                      {(footerChanged || footerSectionError) && (
                        <SectionDot error={footerSectionError} />
                      )}
                    </div>
                  </div>
                </div>
              </ui.AccordionTrigger>
              <ui.AccordionContent>
                <div className="px-4 pt-2 space-y-4">
                  {/* Footer Logo */}
                  <Field id="field-footer-logo" highlighted={highlighted} className="space-y-2">
                    <FieldLabel title="Logo shown in the site footer on light backgrounds.">
                      Light Mode
                    </FieldLabel>
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center flex-shrink-0 w-20 h-20">
                        {currentFooterLogoUrl ? (
                          <img
                            src={currentFooterLogoUrl}
                            alt="Footer logo"
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
                            setCurrentFooterLogoUrl(toPublicAssetUrl(uploadedPath));
                          }}
                        />
                      </div>
                    </div>
                  </Field>

                  {/* Footer Logo - Dark Mode */}
                  <Field
                    id="field-footer-logo-dark"
                    highlighted={highlighted}
                    className="space-y-2"
                  >
                    <FieldLabel title="Logo shown in the site footer when a visitor is using dark mode.">
                      Dark Mode
                    </FieldLabel>
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center flex-shrink-0 w-20 h-20 rounded bg-slate-900">
                        {currentFooterLogoDarkUrl ? (
                          <img
                            src={currentFooterLogoDarkUrl}
                            alt="Footer logo dark mode"
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
                            setCurrentFooterLogoDarkUrl(toPublicAssetUrl(uploadedPath));
                          }}
                        />
                      </div>
                    </div>
                  </Field>

                  {/* Footer Tagline */}
                  <Field id="field-tagline" highlighted={highlighted} className="pt-4 space-y-2">
                    <FieldLabel
                      htmlFor="site-tagline"
                      title="A short line shown under the logo in the site footer."
                    >
                      Tagline
                    </FieldLabel>
                    <ui.Input
                      id="site-tagline"
                      value={currentTagline}
                      onChange={(e) => setCurrentTagline(e.target.value)}
                      placeholder="Enter site tagline"
                      disabled={!canEdit}
                    />
                  </Field>

                  <Field id="field-social-links" highlighted={highlighted} className="space-y-2">
                    <FieldLabel
                      title="Links shown as icons in the site footer; the icon is worked out from the link. Drag to reorder."
                      error={socialLinksProblem}
                    >
                      Social Links
                    </FieldLabel>
                    <SocialLinksField
                      key={`social-${resetKey}`}
                      links={currentSocialLinks}
                      onChange={setCurrentSocialLinks}
                      disabled={!canEdit}
                    />
                  </Field>

                  <Field id="field-footer-links" highlighted={highlighted} className="space-y-2">
                    <FieldLabel
                      title="Link columns shown in the site footer. Drag links to reorder them or move them between columns."
                      error={footerLinksProblem}
                    >
                      Footer Links
                    </FieldLabel>
                    <FooterLinksField
                      key={`footer-links-${resetKey}`}
                      links={currentFooterLinks}
                      onChange={setCurrentFooterLinks}
                      disabled={!canEdit}
                    />
                  </Field>
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
            {saveError ? (
              <ui.SimpleTooltip title={saveError} className={ERROR_TOOLTIP_CLASS}>
                {/* A disabled button fires no pointer events, so the span carries the tooltip */}
                <span className="inline-flex">
                  <ui.Button disabled>Save changes</ui.Button>
                </span>
              </ui.SimpleTooltip>
            ) : (
              <ui.Button onClick={handleSave} disabled={!dirty || !canSave}>
                Save changes
              </ui.Button>
            )}
          </div>
        </div>
      </div>

      <UnsavedChangesGuard
        dirty={dirty}
        fetcher={fetcher}
        canSave={canSave}
        saveError={saveError}
        description="You have unsaved changes to this site's design. Would you like to save them before leaving this page?"
        onSave={handleSave}
        onDiscard={resetFromLoaderData}
      />
    </div>
  );
}
