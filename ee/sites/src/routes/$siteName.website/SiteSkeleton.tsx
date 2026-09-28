import type { FooterLink, SiteDTO, SocialLink } from '@curvenote/common';
import { SkeletonFooter } from './SkeletonFooter.js';
import { Hotspot, type OnSelectTarget } from './designTargets.js';
import { GlobeIcon, MicroscopeIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { buildFontCss, googleFontsHref } from '../../themeConfig/fonts.js';
import type { ThemeFontsConfig } from '../../themeConfig/types.js';

type SiteSkeletonProps = {
  site: SiteDTO;
  logoUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  footerLogoUrl?: string;
  footerLogoDarkUrl?: string;
  tagline?: string;
  social?: SocialLink[];
  footerLinks?: FooterLink[][];
  themeColorPrimary?: string;
  themeColorSecondary?: string;
  /** Site fonts, applied to the preview the way the theme applies them to a page. */
  fonts?: ThemeFontsConfig;
  /** When set, regions of the preview can be clicked to jump to their settings. */
  onSelect?: OnSelectTarget;
};

/*
 * The theme's default stacks, so an unset slot previews as the site would render it. Kept in
 * step with next-theme packages/styles/fonts.css.
 */
const PREVIEW_FONT_DEFAULTS = `
.site-preview {
  --font-body: 'Noto Sans', ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-body);
  --font-small: var(--font-body);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}`;
const PREVIEW_DEFAULT_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap';

export function SiteSkeleton({
  site,
  logoUrl,
  logoDarkUrl,
  faviconUrl,
  footerLogoUrl,
  footerLogoDarkUrl,
  tagline,
  social,
  footerLinks,
  themeColorPrimary = '#3b82f6',
  themeColorSecondary = '#64748b',
  fonts,
  onSelect,
}: SiteSkeletonProps) {
  const [isDark, setIsDark] = useState(false);

  const displayLogo = isDark && logoDarkUrl ? logoDarkUrl : logoUrl;
  const fontCss = buildFontCss(fonts, { scope: '.site-preview' });
  const googleHref = googleFontsHref(fonts);
  // The theme loads Noto Sans for an unset body slot; do the same so "default" previews truly
  const needsDefaultBody = !fonts?.body;
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="site-preview w-full overflow-hidden border rounded-lg shadow-sm border-stone-300 dark:border-stone-600">
      {/* Fonts, scoped to the preview so the admin's own chrome is untouched */}
      <style dangerouslySetInnerHTML={{ __html: `${PREVIEW_FONT_DEFAULTS}\n${fontCss}` }} />
      {needsDefaultBody && <link rel="stylesheet" href={PREVIEW_DEFAULT_GOOGLE} />}
      {googleHref && <link rel="stylesheet" href={googleHref} />}
      {/* Browser chrome */}
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-stone-100 border-stone-200 dark:bg-stone-800 dark:border-stone-700">
        <div className="flex gap-1.5 flex-shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-400/80" />
          <div className="w-3 h-3 rounded-full bg-amber-400/80" />
          <div className="w-3 h-3 rounded-full bg-green-400/80" />
        </div>
        {/* Address bar, showing the favicon as the browser would */}
        <div className="flex items-center flex-1 min-w-0 gap-2 px-3 py-1 bg-white rounded-full dark:bg-stone-900">
          <Hotspot
            target="favicon"
            label="Edit favicon"
            onSelect={onSelect}
            className="flex-shrink-0"
          >
            {faviconUrl ? (
              <img src={faviconUrl} alt="Favicon" className="object-contain w-4 h-4 rounded-sm" />
            ) : (
              <GlobeIcon className="w-4 h-4 text-stone-400" />
            )}
          </Hotspot>
          <span className="text-xs truncate text-stone-500 dark:text-stone-400">{site.url}</span>
        </div>
      </div>

      <div style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderColor: isDark ? '#1e293b' : '#e2e8f0',
          }}
        >
          {/* Logo and Name */}
          <div className="flex items-center gap-3">
            <Hotspot
              target={isDark ? 'logoDark' : 'logo'}
              label={isDark ? 'Edit dark mode logo' : 'Edit logo'}
              onSelect={onSelect}
            >
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt={site.title}
                  className="object-contain w-8 h-8 rounded"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-gradient-to-br from-green-600 to-amber-700" />
              )}
            </Hotspot>
            <Hotspot target="title" label="Edit site title" onSelect={onSelect}>
              <span
                className="text-sm font-semibold tracking-wide uppercase"
                style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
              >
                {site.title}
              </span>
            </Hotspot>
          </div>

          {/* Nav placeholders and theme toggle */}
          <div className="flex items-center gap-3">
            <div className="items-center hidden gap-2 sm:flex">
              <div
                className="w-16 h-6 rounded"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              />
              <div
                className="w-16 h-6 rounded"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              />
              <div
                className="w-16 h-6 rounded"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              />
              <div
                className="w-16 h-6 rounded"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              />
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
              style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <SunIcon className="w-4 h-4" style={{ color: '#94a3b8' }} />
              ) : (
                <MoonIcon className="w-4 h-4" style={{ color: '#64748b' }} />
              )}
            </button>
          </div>
        </div>

        {/* Main Hero Section - Dark */}
        <div
          className="relative flex flex-col items-center justify-center gap-4 px-6 py-12"
          style={{ backgroundColor: themeColorPrimary }}
        >
          {/* Covers the banner so clicking anywhere on it targets the primary color;
              the CTA below sits above it, so the two never nest */}
          {onSelect && (
            <Hotspot
              target="colors.primary"
              label="Edit primary color"
              onSelect={onSelect}
              className="absolute inset-0 rounded-none -outline-offset-2"
            />
          )}

          {/* Title in the heading font; clicking it edits that slot */}
          <Hotspot
            target="fonts.heading"
            label="Edit heading font"
            onSelect={onSelect}
            className="relative max-w-[80%] px-2"
          >
            <div
              className="text-2xl font-bold leading-tight text-center text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {site.title}
            </div>
          </Hotspot>

          {/* Subtitle placeholder */}
          <div className="w-1/2 h-6 rounded pointer-events-none bg-white/80" />

          {/* CTA Buttons */}
          <div className="relative flex items-center gap-3 mt-4">
            <Hotspot
              target="colors.secondary"
              label="Edit secondary color"
              onSelect={onSelect}
              className="px-6 py-2 border-2 rounded border-white/80"
              style={{ backgroundColor: themeColorSecondary }}
            >
              <div className="w-20 h-5 rounded bg-white/30" />
            </Hotspot>
            <div className="px-6 py-2 border-2 rounded border-white/80">
              <div className="w-20 h-5 rounded bg-white/30" />
            </div>
          </div>
        </div>

        {/* Bottom Cards Section */}
        <div className="px-6 py-8" style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
          <div className="grid grid-cols-3 gap-4">
            {/* First card carries sample text so body and small fonts can be seen */}
            <div
              className="flex flex-col justify-between gap-2 p-3 rounded-lg aspect-square"
              style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
            >
              <Hotspot target="fonts.body" label="Edit body font" onSelect={onSelect}>
                <p
                  className="text-xs leading-snug line-clamp-4"
                  style={{ fontFamily: 'var(--font-body)', color: textColor }}
                >
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua.
                </p>
              </Hotspot>
              <Hotspot target="fonts.small" label="Edit small text font" onSelect={onSelect}>
                <p
                  className="text-[10px] leading-tight"
                  style={{ fontFamily: 'var(--font-small)', color: mutedColor }}
                >
                  Figure 1: Caption in the small text font.
                </p>
              </Hotspot>
            </div>
            {[2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-lg aspect-square"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              >
                <MicroscopeIcon
                  className="w-8 h-8"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer — falls back to the header logo the same way the theme does */}
        <SkeletonFooter
          title={site.title}
          logoUrl={footerLogoUrl || logoUrl}
          logoDarkUrl={footerLogoDarkUrl || (footerLogoUrl ? undefined : logoDarkUrl)}
          tagline={tagline}
          social={social ?? site.social_links}
          links={footerLinks ?? site.footer_links}
          isDark={isDark}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
