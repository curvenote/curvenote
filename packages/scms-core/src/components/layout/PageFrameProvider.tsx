import React, { createContext, useContext, useState, useCallback } from 'react';
import type { BreadcrumbItemConfig } from '../ui/ConfigurableBreadcrumb.js';

export interface PageFrameState {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  breadcrumbs?: BreadcrumbItemConfig[];
  className?: string;
  hasSecondaryNav?: boolean;
}

interface PageFrameContextValue {
  state: PageFrameState;
  updatePageFrame: (updates: Partial<PageFrameState>) => void;
  resetPageFrame: () => void;
}

const PageFrameContext = createContext<PageFrameContextValue | null>(null);

export interface PageFrameProviderProps {
  children: React.ReactNode;
  initialProps?: Partial<PageFrameState>;
}

export function PageFrameProvider({ children, initialProps = {} }: PageFrameProviderProps) {
  const [state, setState] = useState<PageFrameState>({
    hasSecondaryNav: true,
    ...initialProps,
  });

  const updatePageFrame = useCallback((updates: Partial<PageFrameState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetPageFrame = useCallback(() => {
    setState({
      hasSecondaryNav: true,
      ...initialProps,
    });
  }, [initialProps]);

  const value: PageFrameContextValue = {
    state,
    updatePageFrame,
    resetPageFrame,
  };

  return <PageFrameContext.Provider value={value}>{children}</PageFrameContext.Provider>;
}

export function usePageFrame() {
  const context = useContext(PageFrameContext);
  if (!context) {
    throw new Error('usePageFrame must be used within a PageFrameProvider');
  }
  return context;
}
