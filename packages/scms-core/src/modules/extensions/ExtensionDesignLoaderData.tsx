import { createContext, useContext, type ReactNode } from 'react';

export type ExtensionDesignLoaderDataByExtension = Record<string, Record<string, unknown>>;

const ExtensionDesignTabLoaderDataContext = createContext<Record<string, unknown> | undefined>(
  undefined,
);

/**
 * Supplies one extension's Design-page loader slice to that extension's tab content.
 * The system Design route wraps each extension tab with this provider.
 */
export function ExtensionDesignTabLoaderDataProvider({
  loaderData,
  children,
}: {
  loaderData: Record<string, unknown> | undefined;
  children: ReactNode;
}) {
  return (
    <ExtensionDesignTabLoaderDataContext.Provider value={loaderData}>
      {children}
    </ExtensionDesignTabLoaderDataContext.Provider>
  );
}

/** Read the active extension tab's loader data on the system Design page. */
export function useExtensionDesignLoaderData(): Record<string, unknown> | undefined {
  return useContext(ExtensionDesignTabLoaderDataContext);
}
