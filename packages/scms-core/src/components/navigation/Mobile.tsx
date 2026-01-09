import React, { useState } from 'react';
import { Button } from '../ui/button.js';
import { Menu, X } from 'lucide-react';

type MobileContextType = {
  open: boolean;
  setMobileOpen: (value: boolean) => void;
};

const MobileContext = React.createContext<MobileContextType>({
  open: false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setMobileOpen: (value: boolean) => {},
});

export function Mobile({ children }: React.PropsWithChildren) {
  const [open, setMobileOpen] = useState(false);

  return (
    <MobileContext.Provider value={{ open, setMobileOpen }}>{children}</MobileContext.Provider>
  );
}

export function useMobile() {
  return React.useContext(MobileContext);
}

export function MobileControls() {
  const { open, setMobileOpen } = useMobile();
  return (
    <>
      {open && (
        <div className="absolute inset-0 z-10 xl:hidden bg-stone-50/90 dark:bg-stone-900/90" />
      )}
      <div className="fixed z-30 flex items-center justify-center top-2 right-2 xl:hidden">
        {!open && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!open)}>
            <Menu className="stroke-[1.5px] w-12 h-12" />
          </Button>
        )}
        {open && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!open)}>
            <X className="stroke-[1.5px] w-12 h-12" />
          </Button>
        )}
      </div>
    </>
  );
}
