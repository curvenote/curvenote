import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button.js';
import { Menu, X } from 'lucide-react';

type MobileContextType = {
  open: boolean;
  setMobileOpen: (value: boolean) => void;
};

const MobileContext = React.createContext<MobileContextType>({
  open: false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setMobileOpen: (value: boolean): void => {
    return;
  },
});

export function Mobile({ children }: React.PropsWithChildren) {
  const [open, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [open]);

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
    <div className="flex fixed top-2 left-1 z-30 justify-start items-center w-[110px] xl:hidden">
      {open ? (
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        >
          <X className="stroke-[1.5px] w-12 h-12" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="stroke-[1.5px] w-12 h-12" />
        </Button>
      )}
    </div>
  );
}
