import { Mail } from 'lucide-react';
import { useLocation } from 'react-router';

export interface MailtoLinkProps {
  label: string;
  email: string;
  subject?: string;
  body?: string;
}

export function MailtoLink({ label, email, subject, body }: MailtoLinkProps) {
  const location = useLocation();

  // Build email body with optional custom body and current page
  const currentPageInfo = `Current Page: ${location.pathname}`;

  let emailBody = currentPageInfo;
  if (body) {
    emailBody = `\n\n${body}\n\n\n\n${currentPageInfo}`;
  }

  // Build full mailto URL with optional subject and combined body
  let fullMailtoUrl = `mailto:${email}`;
  if (subject || emailBody) {
    fullMailtoUrl += '?';
    if (subject) {
      fullMailtoUrl += `subject=${encodeURIComponent(subject)}`;
      if (emailBody) {
        fullMailtoUrl += '&';
      }
    }
    if (emailBody) {
      fullMailtoUrl += `body=${encodeURIComponent(emailBody)}`;
    }
  }

  // Short mailto URL for clean tooltip display
  const shortMailtoUrl = `mailto:${email}`;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = fullMailtoUrl;
  };

  return (
    <a
      href={shortMailtoUrl}
      className="flex gap-1 items-center text-xs transition-colors hover:text-stone-800 dark:hover:text-stone-200"
      tabIndex={0}
      aria-label={`${label} via email`}
      onClick={handleClick}
    >
      <Mail className="w-3 h-3 stroke-3" />
      <span>{label}</span>
    </a>
  );
}

// EXTENSIBILITY NOTE:
// To add new component types to the configurable StatusBar system:
// 1. Add the new type to the 'type' enum in .app-config.schema.yml StatusBarItem definition
// 2. Create a new Properties interface in the schema (e.g., ButtonLinkProperties) and add to oneOf
// 3. Update the StatusBarItem type union in types/app-config.d.ts
// 4. Create the new component following this same pattern (props interface + component)
// 5. Add the component to the type resolution logic in StatusBarContent.tsx
