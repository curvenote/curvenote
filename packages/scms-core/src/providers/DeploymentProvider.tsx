import { createContext, useContext, useMemo } from 'react';
import type { ClientSideSafeAuthOptions } from '../modules/auth/types.js';
import type { ClientSigninSignupConfig } from '../backend/signup/types.js';

export type ClientDeploymentBranding = {
  title?: string;
  subtitle?: string;
  description?: string;
  logo?: string;
  logoDark?: string;
  icon?: string;
  iconDark?: string;
  splash?: string;
  showLoginLink?: boolean;
  poweredBy?: boolean;
  supportEmail?: string;
  welcome?: WelcomeContent;
};

export type WelcomeContent = {
  title?: string;
  tagline?: string;
  description?: string;
  showTasks?: boolean;
  videos?: WelcomeVideo[];
};

export type WelcomeVideo = {
  title: string;
  url: string;
  thumbnail?: string;
};

export type ClientDeploymentNavigation = SimpleNavItemType[];

export type SimpleNavItemType = {
  name: string;
  label: string;
  icon: string;
  path: string;
  hidden?: boolean;
  end?: boolean;
  beta?: boolean;
};

export type NavigationHelpItem = {
  enabled: boolean;
  icon: string;
  scopes?: string[];
  properties: {
    label: string;
    prompt?: string;
    title?: string;
    description?: string;
    successMessage?: string;
  };
};

export type ClientStatusBarItem =
  | {
      name: string;
      type: 'mailto-link';
      position: 'left' | 'right';
      properties: {
        label: string;
        email: string;
        subject?: string;
        body?: string;
      };
    }
  | {
      name: string;
      type: 'request-help';
      position: 'left' | 'right';
      properties: {
        label: string;
        prompt?: string;
        title?: string;
        description?: string;
        successMessage?: string;
      };
    };

export type ClientDeploymentConfig = {
  name: string;
  editorApiUrl: string;
  renderServiceUrl: string | undefined;
  authProviders: ClientSideSafeAuthOptions[];
  signupConfig?: ClientSigninSignupConfig;
  navigation: {
    items: ClientDeploymentNavigation;
    helpItem?: NavigationHelpItem;
  };
  fbClientConfig?: string;
  branding?: ClientDeploymentBranding;
  statusBar?: {
    reportProblem?: {
      email?: string;
      subject?: string;
    };
    items?: ClientStatusBarItem[];
  };
  strings?: {
    app?: {
      signupAdvice?: string;
      signupUrl?: string;
      signupUrlText?: string;
    };
  };
  buildInfo?: {
    version?: string;
  };
  extensions?: Record<
    string,
    {
      name: string;
      capabilities: string[];
    }
  >;
};

export type DeploymentContextType = { config: ClientDeploymentConfig };

const DeploymentContext = createContext<DeploymentContextType | undefined>(undefined);

export function DeploymentProvider({
  config,
  children,
}: {
  config: ClientDeploymentConfig;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ config }), [config]);

  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>;
}

export function useDeploymentConfig() {
  const context = useContext(DeploymentContext);
  if (context === undefined) {
    throw new Error('useDeploymentConfig must be used within a DeploymentConfigProvider');
  }
  return context.config;
}
