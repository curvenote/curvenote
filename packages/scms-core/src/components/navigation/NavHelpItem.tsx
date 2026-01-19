import { useState } from 'react';
import { useLocation } from 'react-router';
import { RequestHelpDialog } from '../RequestHelpDialog.js';
import { MenuIcon } from './MenuIcon.js';
import { SimpleTooltip } from '../ui/tooltip.js';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../components/ui/menu.js';
import { useMyUser } from '../../providers/MyUserProvider.js';
import type { NavigationHelpItem } from '../../providers/DeploymentProvider.js';
import type { ClientExtension } from '../../modules/extensions/types.js';
import { Button } from '../ui/index.js';

export function NavHelpItem({
  helpItem,
  extensions,
}: {
  helpItem: NavigationHelpItem;
  extensions?: ClientExtension[];
}) {
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
  const { icon, properties } = helpItem;

  return (
    <>
      <SimpleTooltip title={properties.label} delayDuration={1000}>
        <Button
          variant="ghost"
          size="icon"
          className="[&_svg]:size-7"
          onClick={() => setOpen(true)}
        >
          <MenuIcon className="w-7 h-7 stroke-[1.5]" name={icon} extensions={extensions} />
        </Button>
      </SimpleTooltip>
      <RequestHelpDialog
        orcid={orcid}
        open={open}
        onOpenChange={setOpen}
        prompt={properties.prompt}
        title={properties.title}
        description={properties.description}
        actionUrl="/app/request-help"
        successMessage={properties.successMessage}
        currentPage={currentPage}
      />
    </>
  );
}
