import type { SiteDTO } from '@curvenote/common';
import { MicroscopeIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';

type SiteSkeletonProps = {
  site: SiteDTO;
  logoUrl?: string;
  logoDarkUrl?: string;
  themeColorPrimary?: string;
  themeColorSecondary?: string;
};

export function SiteSkeleton({
  site,
  logoUrl,
  logoDarkUrl,
  themeColorPrimary = '#3b82f6',
  themeColorSecondary = '#64748b',
}: SiteSkeletonProps) {
  const [isDark, setIsDark] = useState(false);

  const displayLogo = isDark && logoDarkUrl ? logoDarkUrl : logoUrl;

  return (
    <div
      className="w-full overflow-hidden border rounded-lg shadow-sm"
      style={{
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
      }}
    >
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
          {displayLogo ? (
            <img src={displayLogo} alt={site.title} className="object-contain w-8 h-8 rounded" />
          ) : (
            <div className="w-8 h-8 rounded bg-gradient-to-br from-green-600 to-amber-700" />
          )}
          <span
            className="text-sm font-semibold tracking-wide uppercase"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
          >
            {site.title}
          </span>
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
        className="flex flex-col items-center justify-center gap-4 px-6 py-12"
        style={{ backgroundColor: themeColorPrimary }}
      >
        {/* Title placeholder */}
        <div className="w-3/4 h-8 rounded bg-white/90" />

        {/* Subtitle placeholder */}
        <div className="w-1/2 h-6 rounded bg-white/80" />

        {/* CTA Buttons */}
        <div className="flex items-center gap-3 mt-4">
          <div
            className="px-6 py-2 border-2 rounded border-white/80"
            style={{
              backgroundColor: themeColorSecondary,
            }}
          >
            <div className="w-20 h-5 rounded bg-white/30" />
          </div>
          <div className="px-6 py-2 border-2 rounded border-white/80">
            <div className="w-20 h-5 rounded bg-white/30" />
          </div>
        </div>
      </div>

      {/* Bottom Cards Section */}
      <div className="px-6 py-8" style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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

      {/* Footer */}
      <div
        className="flex items-center justify-between px-6 py-4 border-t"
        style={{
          backgroundColor: themeColorPrimary,
          borderColor: isDark ? '#1e293b' : '#e2e8f0',
        }}
      >
        <div className="w-32 h-8 rounded bg-white/20" />
        <div className="flex items-center gap-2">
          <div className="w-16 h-6 rounded bg-white/20" />
          <div className="w-16 h-6 rounded bg-white/20" />
          <div className="w-16 h-6 rounded bg-white/20" />
        </div>
      </div>
    </div>
  );
}
