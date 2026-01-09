import { Img, Section } from '@react-email/components';
import type { Branding } from '@/types/app-config.js';

interface LogoProps {
  asBaseUrl: (path: string) => string;
  branding?: Branding;
  className?: string;
}

const DEFAULT_LOGO = 'https://cdn.curvenote.com/static/site/curvenote/favicon.ico';

export function Logo({ asBaseUrl, branding, className = '' }: LogoProps) {
  const logo = branding?.logoEmail ?? branding?.logo ?? DEFAULT_LOGO;
  const platformTitle = branding?.title ?? 'Curvenote';
  return (
    <Section className={`mt-[32px] ${className}`}>
      <Img
        src={logo.startsWith('/') ? asBaseUrl(logo) : logo}
        height="37"
        alt={platformTitle}
        className="mx-auto my-0"
      />
    </Section>
  );
}
