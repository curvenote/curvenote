import { Mail } from 'lucide-react';
import { useLocation } from 'react-router';
import { useDeploymentConfig } from '../../providers/DeploymentProvider.js';
import { useSystemInfo } from './systemInfo.js';

export function ReportProblem() {
  const email = 'support@curvenote.com';
  const subject = 'Feedback';
  const body =
    'Please describe your issue; include any error messages, steps you were taking, relevant screenshots, and what you expected to happen.';
  const location = useLocation();
  const config = useDeploymentConfig();
  const systemInfo = useSystemInfo(config.buildInfo?.version);

  // Build email body with optional custom body, current page, and system information
  const currentPageInfo = `Current Page: ${location.pathname}${location.search}${location.hash}`;

  let emailBody = currentPageInfo;
  if (body) {
    emailBody = `\n\n${body}\n\n\n\n${currentPageInfo}`;
  }
  if (systemInfo) {
    emailBody = `${emailBody}\n\n${systemInfo}`;
  }

  const fullMailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
  const shortMailtoUrl = `mailto:${email}`;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = fullMailtoUrl;
  };

  return (
    <a
      href={shortMailtoUrl}
      className="flex items-center gap-1 text-xs transition-colors hover:text-stone-800 dark:hover:text-stone-200"
      tabIndex={0}
      aria-label="Report a problem via email"
      onClick={handleClick}
    >
      <Mail className="w-3 h-3 stroke-3" />
      <span>Report a Problem</span>
    </a>
  );
}
