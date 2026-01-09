import { Moon, Sun } from 'lucide-react';
import { Theme, useTheme } from '../providers/ThemeProvider.js';
import { Button } from './ui/button.js';
import { SimpleTooltip } from './ui/tooltip.js';

export function ThemeSwitcher({ variant = 'icon' }: { variant?: 'icon' | 'icon-sm' | 'icon-xs' }) {
  const [theme, setTheme] = useTheme();
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT));
  };
  return (
    <SimpleTooltip title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <div>
        <Button variant="ghost" size={variant} onClick={toggleTheme}>
          {theme === 'dark' ? (
            <Sun className="stroke-[1.5px]" />
          ) : (
            <Moon className="stroke-[1.5px]" />
          )}
        </Button>
      </div>
    </SimpleTooltip>
  );
}
