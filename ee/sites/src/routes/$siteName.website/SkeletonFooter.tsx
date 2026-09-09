import type { FooterLink, SocialLink } from '@curvenote/common';
import {
  BlueskyIcon,
  CurvenoteIcon,
  DiscordIcon,
  DiscourseIcon,
  EmailIcon,
  GithubIcon,
  LinkedinIcon,
  MastodonIcon,
  SlackIcon,
  TwitterIcon,
  WebsiteIcon,
  YoutubeIcon,
} from '@scienceicons/react/24/solid';

const SOCIAL_ICONS = {
  bluesky: BlueskyIcon,
  twitter: TwitterIcon,
  mastodon: MastodonIcon,
  linkedin: LinkedinIcon,
  github: GithubIcon,
  slack: SlackIcon,
  email: EmailIcon,
  discord: DiscordIcon,
  website: WebsiteIcon,
  youtube: YoutubeIcon,
  discourse: DiscourseIcon,
} as const;

type SkeletonFooterProps = {
  title: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  tagline?: string;
  social?: SocialLink[];
  links?: FooterLink[][];
  isDark: boolean;
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
}: SkeletonFooterProps) {
  const displayLogo = isDark && logoDarkUrl ? logoDarkUrl : logoUrl;
  const textColor = isDark ? '#f5f5f4' : '#1c1917';
  const placeholderColor = isDark ? '#292524' : '#e7e5e4';

  return (
    <>
      <div className="px-6 py-6" style={{ backgroundColor: isDark ? '#1c1917' : '#f5f5f4' }}>
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex-shrink-0">
            {displayLogo ? (
              <img
                src={displayLogo}
                alt={title}
                className="object-contain w-auto h-12 max-w-[200px]"
              />
            ) : (
              <div className="w-32 h-12 rounded" style={{ backgroundColor: placeholderColor }} />
            )}
            {tagline && (
              <div className="mt-2 text-xs font-light" style={{ color: textColor }}>
                {tagline}
              </div>
            )}
            {social && social.length > 0 && (
              <div className="flex items-center gap-2 mt-3 opacity-70">
                {social.map((link) => {
                  const Icon = SOCIAL_ICONS[link.kind as keyof typeof SOCIAL_ICONS] ?? WebsiteIcon;
                  return (
                    <Icon
                      key={`${link.kind}-${link.url}`}
                      className="w-4 h-4"
                      style={{ color: textColor }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-row gap-6 grow sm:justify-end">
            {links?.map((column, i) => (
              <ul key={i} className="text-xs leading-loose" style={{ color: textColor }}>
                {column.map((link) => (
                  <li key={link.url}>{link.title}</li>
                ))}
              </ul>
            ))}
          </div>
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
