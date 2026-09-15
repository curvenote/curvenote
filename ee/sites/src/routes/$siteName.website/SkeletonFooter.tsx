import type { FooterLink, SocialLink } from '@curvenote/common';
import { CurvenoteIcon } from '@scienceicons/react/24/solid';
import { SocialIcon } from './SocialLinksField.js';
import { Hotspot, type OnSelectTarget } from './designTargets.js';

type SkeletonFooterProps = {
  title: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  tagline?: string;
  social?: SocialLink[];
  links?: FooterLink[][];
  isDark: boolean;
  onSelect?: OnSelectTarget;
};

/**
 * A preview of the site footer, mirroring the `JournalFooter` the theme renders:
 * logo, tagline and social icons on the left, footer link columns on the right,
 * with the Curvenote brand bar underneath. Links are inert here — this is a preview.
 */
export function SkeletonFooter({
  title,
  logoUrl,
  logoDarkUrl,
  tagline,
  social,
  links,
  isDark,
  onSelect,
}: SkeletonFooterProps) {
  const displayLogo = isDark && logoDarkUrl ? logoDarkUrl : logoUrl;
  const textColor = isDark ? '#f5f5f4' : '#1c1917';
  const placeholderColor = isDark ? '#292524' : '#e7e5e4';

  return (
    <>
      <div className="px-6 py-6" style={{ backgroundColor: isDark ? '#1c1917' : '#f5f5f4' }}>
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-start flex-shrink-0">
            <Hotspot
              target={isDark ? 'footer.logoDark' : 'footer.logo'}
              label={isDark ? 'Edit dark mode footer logo' : 'Edit footer logo'}
              onSelect={onSelect}
            >
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt={title}
                  className="object-contain w-auto h-12 max-w-[200px]"
                />
              ) : (
                <div className="w-32 h-12 rounded" style={{ backgroundColor: placeholderColor }} />
              )}
            </Hotspot>
            {(tagline || onSelect) && (
              <Hotspot
                target="footer.tagline"
                label="Edit tagline"
                onSelect={onSelect}
                className="mt-2 text-xs font-light"
                style={{ color: textColor }}
              >
                {tagline || <span className="italic opacity-50">Add a tagline</span>}
              </Hotspot>
            )}
            {social && social.length > 0 && (
              <Hotspot
                target="footer.social"
                label="Edit social links"
                onSelect={onSelect}
                className="flex items-center gap-2 mt-3 opacity-70"
              >
                {social.map((link) => (
                  <SocialIcon
                    key={`${link.kind}-${link.url}`}
                    kind={link.kind}
                    className="w-4 h-4"
                    style={{ color: textColor }}
                  />
                ))}
              </Hotspot>
            )}
          </div>

          <Hotspot
            target="footer.links"
            label="Edit footer links"
            onSelect={onSelect}
            className="flex flex-row gap-6 grow sm:justify-end"
          >
            {links?.map((column, i) => (
              <ul key={i} className="text-xs leading-loose" style={{ color: textColor }}>
                {column.map((link) => (
                  <li key={link.url}>{link.title}</li>
                ))}
              </ul>
            ))}
          </Hotspot>
        </div>
      </div>

      {/* Curvenote brand bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-stone-700">
        <span className="text-xs text-white/70">Terms &amp; Privacy</span>
        <CurvenoteIcon className="w-4 h-4 text-white" />
      </div>
    </>
  );
}
