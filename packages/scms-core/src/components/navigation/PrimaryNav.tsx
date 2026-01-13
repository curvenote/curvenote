import type { SimpleNavItemType } from '../../providers/DeploymentProvider.js';
import { useDeploymentConfig } from '../../providers/DeploymentProvider.js';
import { cn } from '../../utils/index.js';
import { NavLink } from 'react-router';
import { MenuIcon } from './MenuIcon.js';
import { useMobile } from './Mobile.js';
import { UserMenu } from './UserMenu.js';
import { NavHelpItem } from './NavHelpItem.js';
import { useMyUser } from '../../providers/MyUserProvider.js';
import type { ClientExtension } from '../../modules/extensions/types.js';

function CurvenoteIconLogo({ className }: { className?: string }) {
  return (
    <img
      className={cn(className, 'inline-block h-10')}
      src="https://cdn.curvenote.com/static/site/curvenote/logo-icon-white.svg"
      alt="Curvenote Publishing Platform"
    />
  );
}

function IconLogoHolder({
  className,
  icon,
  alt,
}: {
  className: string;
  icon: string;
  alt: string;
}) {
  return <img className={className} src={icon} alt={alt} />;
}

function PrimaryNavItem({
  item,
  extensions,
}: {
  item: SimpleNavItemType;
  extensions?: ClientExtension[];
}) {
  const { path, label, icon, end } = item;
  const iconIsImage = icon.match(/^http[s]:\/\//) != null;

  return (
    <NavLink
      to={`/app/${path}`}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex items-center justify-center w-full text-xs text-center rounded hover:bg-stone-50/10 focus:bg-stone-50/10 text-white',
          {
            "before:absolute before:inset-y-0 before:left-0 before:h-full before:w-1 before:rounded-r-full before:bg-white dark:before:bg-white before:content-['']":
              isActive,
          },
        )
      }
    >
      <div className="flex flex-col items-center justify-center w-full p-2">
        <div className="flex items-center justify-center w-full h-10">
          {iconIsImage ? (
            <img data-name="primary-nav-item-img" src={icon} alt={label} className="h-6" />
          ) : (
            <MenuIcon
              className="w-6 h-6 filter brightness-0 invert"
              name={icon}
              extensions={extensions}
            />
          )}
        </div>
        <div>{label}</div>
      </div>
    </NavLink>
  );
}

export function PrimaryNav({ extensions }: { extensions?: ClientExtension[] }) {
  const { navigation, branding } = useDeploymentConfig();
  const { open } = useMobile();
  const user = useMyUser();

  let logo = <CurvenoteIconLogo className="my-[60px]" />;
  const brandingIcon = branding?.icon ?? branding?.logo;
  if (brandingIcon) {
    logo = (
      <IconLogoHolder
        className="my-[60px] px-4"
        icon={brandingIcon}
        alt={branding?.title ?? 'Curvenote'}
      />
    );
  }

  // Check if help item should be shown
  // helpItem is enabled by default if it exists (enabled is optional, defaults to true)
  // Only disable if explicitly set to false
  const showHelpItem =
    navigation.helpItem &&
    navigation.helpItem.enabled !== false &&
    (!navigation.helpItem.scopes ||
      (user?.scopes && navigation.helpItem.scopes.every((scope) => user.scopes?.includes(scope))));

  return (
    <nav
      className={cn(
        'flex fixed z-20 flex-col items-center py-1 space-y-2 h-full text-white bg-blue-900 transition-transform duration-150 ease-in-out transform w-[110px]',
        { '-translate-x-full xl:translate-x-0': !open },
        { 'translate-x-0': open },
      )}
    >
      {logo}
      <div className="flex flex-col items-center w-full pb-4 overflow-y-auto scrollbar scrollbar-thin scrollbar-track-slate-700 scrollbar-thumb-slate-400 grow">
        {navigation.items.map((item) => (
          <PrimaryNavItem key={item.name} item={item} extensions={extensions} />
        ))}
        <div className="grow min-h-8" />
      </div>
      <div className="flex flex-col items-center w-full">
        {showHelpItem && navigation.helpItem && (
          <NavHelpItem helpItem={navigation.helpItem} extensions={extensions} />
        )}
        <UserMenu />
      </div>
    </nav>
  );
}
