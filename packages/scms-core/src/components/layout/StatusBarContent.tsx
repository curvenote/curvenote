import { StatusBar } from './StatusBar.js';
import { CurvenotePowered } from './CurvenotePowered.js';
import { MailtoLink } from './MailtoLink.js';
import { HelpRequestLink } from './HelpRequestLink.js';
import { AppVersion } from './AppVersion.js';
import { ThemeSwitcher } from '../ThemeSwitcher.js';
import {
  useDeploymentConfig,
  type ClientStatusBarItem,
} from '../../providers/DeploymentProvider.js';
import { SimpleTooltip } from '../ui/tooltip.js';
import { app, system } from '../../scopes.js';
import { useMyUser } from '../../providers/MyUserProvider.js';

export interface StatusBarContentProps {
  hasSecondaryNav?: boolean;
}

// Component type resolver for configurable status bar items
function renderStatusBarItem(item: ClientStatusBarItem): React.ReactNode {
  switch (item.type) {
    case 'mailto-link':
      return (
        <SimpleTooltip key={item.name} title="Send an email to get support">
          <div>
            <MailtoLink
              label={item.properties.label}
              email={item.properties.email}
              subject={item.properties.subject}
              body={item.properties.body}
            />
          </div>
        </SimpleTooltip>
      );
    case 'request-help':
      return (
        <SimpleTooltip key={item.name} title="Request help via support form">
          <div>
            <HelpRequestLink
              label={item.properties.label}
              prompt={item.properties.prompt}
              title={item.properties.label}
              description={item.properties.description}
              successMessage={item.properties.successMessage}
            />
          </div>
        </SimpleTooltip>
      );
    // EXTENSIBILITY NOTE:
    // Add new component types here following this pattern:
    // case 'button-link':
    //   return <ButtonLink key={item.name} {...item.properties} />;
    default: {
      // Graceful fallback for unknown component types
      // TypeScript exhaustive check - this should never happen if all types are handled
      const _exhaustive: never = item;
      console.warn(`Unknown status bar item type: ${(_exhaustive as ClientStatusBarItem).type}`);
      return null;
    }
  }
}

export function StatusBarContent({ hasSecondaryNav }: StatusBarContentProps) {
  const config = useDeploymentConfig();
  const user = useMyUser();

  // Separate configurable items by position
  const leftItems = config.statusBar?.items?.filter((item) => item.position === 'left') || [];
  const rightItems = config.statusBar?.items?.filter((item) => item.position === 'right') || [];

  return (
    <StatusBar hasSecondaryNav={hasSecondaryNav}>
      <div className="flex items-center w-full gap-2 sm:gap-3">
        {/* Left-positioned configurable items */}
        {leftItems.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3">
            {leftItems.map(renderStatusBarItem)}
          </div>
        )}

        {/* Spacer to push right content to the right */}
        <div className="grow" />

        {/* Right-positioned configurable items */}
        {rightItems.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3">
            {rightItems.map(renderStatusBarItem)}
          </div>
        )}

        {(user?.scopes?.includes(system.admin) || user?.scopes?.includes(app.platform.admin)) && (
          <SimpleTooltip title="Your Platform Role">
            <div className="flex items-center px-2 text-xs border-r sm:px-3 border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400">
              {user?.scopes?.includes(system.admin) ? 'SYSTEM ADMIN' : 'PLATFORM ADMIN'}
            </div>
          </SimpleTooltip>
        )}
        {/* Permanent components (always present, hardcoded) */}
        <ThemeSwitcher variant="icon-xs" />
        <AppVersion />
        <CurvenotePowered />
      </div>
    </StatusBar>
  );
}
