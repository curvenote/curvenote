import { CurvenoteLogo } from '@curvenote/icons';
import { useTheme, Theme } from '../../providers/ThemeProvider.js';
import { AppInfoPopover } from './AppInfoPopover.js';
import { SimpleTooltip } from '../ui/tooltip.js';

export function CurvenotePowered() {
  const [theme] = useTheme();

  // Use black logo for light theme, white logo for dark theme
  const logoColor = theme === Theme.DARK ? 'white' : 'black';

  return (
    <SimpleTooltip title="Build Information">
      <div>
        <AppInfoPopover>
          <div className="flex items-center gap-1.5 text-xs cursor-pointer transition-colors hover:text-stone-800 dark:hover:text-stone-200 pointer-events-auto">
            <CurvenoteLogo size={14} fill={logoColor} className="flex-shrink-0" />
            <span className="">Powered by Curvenote</span>
          </div>
        </AppInfoPopover>
      </div>
    </SimpleTooltip>
  );
}
