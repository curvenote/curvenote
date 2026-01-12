import { useState } from 'react';
import { useLocation } from 'react-router';
import { HelpCircle } from 'lucide-react';
import { RequestHelpDialog } from '../RequestHelpDialog.js';
import { useMyUser } from '../../providers/MyUserProvider.js';

export interface HelpRequestLinkProps {
  label: string;
  prompt?: string;
  title?: string;
  description?: string;
  successMessage?: string;
}

export function HelpRequestLink({
  label,
  prompt,
  title,
  description,
  successMessage,
}: HelpRequestLinkProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = useMyUser();

  // Get ORCID from user's linked accounts, or use a placeholder
  const orcidAccount = user?.linkedAccounts?.find(
    (account) => account.provider === 'orcid' && !account.pending,
  );
  const orcid = orcidAccount?.idAtProvider || 'unknown';

  // Get current page path for context
  const currentPage = `${location.pathname}${location.search}${location.hash}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs transition-colors hover:text-stone-800 dark:hover:text-stone-200"
        tabIndex={0}
        aria-label={`${label} via help request form`}
      >
        <HelpCircle className="w-3 h-3 stroke-3" />
        <span>{label}</span>
      </button>
      <RequestHelpDialog
        orcid={orcid}
        open={open}
        onOpenChange={setOpen}
        prompt={prompt}
        title={title}
        description={description}
        actionUrl="/app/request-help"
        successMessage={successMessage}
        currentPage={currentPage}
      />
    </>
  );
}
