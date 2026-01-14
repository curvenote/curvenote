import type { Route } from './+types/root';
import { type LinksFunction, redirect } from 'react-router';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import {
  withContext,
  getThemeSession,
  formatMyUserDTO,
  buildClientNavigation,
  loadAndValidateSigninSignupConfig,
} from '@curvenote/scms-server';
import {
  ui,
  cn,
  initializeFirebase,
  GlobalErrorBoundary,
  ThemeProvider,
  MyUserProvider,
  DeploymentProvider,
  matchesWildcard,
  useNavigationTracking,
  validateWorkflows,
  registerExtensionWorkflows,
  registerExtensionsForNavigation,
  ClientOnly,
} from '@curvenote/scms-core';
import { useEffect } from 'react';
import NProgress from 'nprogress';
import type {
  ClientDeploymentConfig,
  ClientStatusBarItem,
  AuthProvider,
  ClientSideSafeAuthOptions,
} from '@curvenote/scms-core';
import packageJson from '../package.json';
import sonnerStyles from './styles/sonner.css?url';
import rootStyle from './styles/root.css?url';
import { extensions } from './extensions/server';
import { extensions as clientExtensions } from './extensions/client';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: rootStyle },
  { rel: 'stylesheet', href: sonnerStyles },
];

type StrictObject<T> = {
  [K in keyof T]: T[K];
};

/**
 * enforces strict type checking on an object
 */
function strictObject<T>(obj: T & StrictObject<T>): T {
  return obj;
}

/**
 * performs key checking on an object at runtime
 */
function validateKeys<T>(obj: T, validKeys: string[]): void {
  function flattenKeys<TT>(obj2: TT, parentKey = ''): string[] {
    const keys: string[] = [];
    for (const key in obj2) {
      if (Object.prototype.hasOwnProperty.call(obj2, key)) {
        const value = obj2[key];
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        if (Array.isArray(value)) {
          // Add the array key itself
          keys.push(fullKey);
          // Also recurse into array elements with numeric indices
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              keys.push(...flattenKeys(item, `${fullKey}.${index}`));
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          // Recursively process nested objects
          keys.push(...flattenKeys(value, fullKey));
        } else {
          // Add scalar values directly
          keys.push(fullKey);
        }
      }
    }
    return keys;
  }

  function isValidKey(key: string, allowedKeys: string[]): boolean {
    // Check for exact match first
    if (allowedKeys.includes(key)) {
      return true;
    }

    // Check for wildcard matches
    const allowedWildcardKeys = allowedKeys.filter((k) => k.includes('*'));
    for (const allowedKey of allowedWildcardKeys) {
      if (allowedKey.includes('*') && matchesWildcard(key, allowedKey)) {
        return true;
      }
    }

    return false;
  }

  const objKeys = flattenKeys<T>(obj);

  for (const key of objKeys) {
    if (!isValidKey(key, validKeys)) {
      throw new Error(`Invalid key: ${key}`);
    }
  }
}

export const loader = async (args: Route.LoaderArgs) => {
  const ctx = await withContext(args);

  registerExtensionsForNavigation(clientExtensions);

  // Validate that all expected workflows are registered (pass extensions for proper missing detection)
  const extensionWorkflows = registerExtensionWorkflows(extensions);
  const missingWorkflows = validateWorkflows(ctx.$config, extensionWorkflows, extensions);
  if (missingWorkflows.length > 0) {
    console.error('Missing required workflows:', missingWorkflows);
    // We don't throw here as this is just a warning, but we could if needed
  }

  const theme = (await getThemeSession(args.request)).getTheme();

  let authProviders: ClientSideSafeAuthOptions[] = [];
  // IMPORTANT ensure that only safe options are passed to the client
  if (ctx.$config.auth) {
    authProviders = Object.entries(ctx.$config.auth).map((entry) => {
      const [provider, value] = entry;
      const baseOptions = {
        provider: provider as AuthProvider,
        displayName: value.displayName,
        allowLogin: value.allowLogin,
        allowLinking: value.allowLinking,
        provisionNewUser: value.provisionNewUser,
        adminLogin: value.adminLogin,
      };

      // Add provider-specific fields
      if (provider === 'firebase' && 'actionTitle' in value) {
        return { ...baseOptions, actionTitle: value.actionTitle };
      }

      return baseOptions;
    });

    // Take extra steps to ensure only expected options are passed to the client
    if (
      !Array.isArray(authProviders) ||
      !authProviders.every((obj) => {
        return Object.keys(obj).every((key) =>
          [
            'provider',
            'displayName',
            'allowLogin',
            'allowLinking',
            'provisionNewUser',
            'adminLogin',
            'actionTitle',
          ].includes(key),
        );
      })
    ) {
      authProviders = [];
    }
  }

  /**
   * build navigation based on deployment configuration and scopes
   */
  type ClientNavigation = ClientDeploymentConfig['navigation'];
  const builtNav: ClientNavigation = ctx.user
    ? ((await buildClientNavigation(
        ctx,
        ctx.$config.app?.navigation,
      )) as unknown as ClientNavigation)
    : { items: [], helpItem: undefined };
  let clientNavigation: ClientNavigation = builtNav;

  // Process helpItem config and apply defaults
  let processedHelpItem: ClientNavigation['helpItem'] | undefined = undefined;
  const navConfig = ctx.$config.app?.navigation;
  type HelpItemConfig = {
    enabled: boolean;
    icon?: string;
    scopes?: string[];
    properties?: {
      label?: string;
      prompt?: string;
      title?: string;
      description?: string;
      successMessage?: string;
    };
  };
  const helpItemConfig: HelpItemConfig | undefined =
    navConfig && 'helpItem' in navConfig
      ? (navConfig as { helpItem?: HelpItemConfig }).helpItem
      : undefined;
  // If helpItem exists, it's enabled by default (enabled is optional)
  // Only disable if explicitly set to false
  if (helpItemConfig && helpItemConfig.enabled !== false) {
    // Apply defaults
    const icon = helpItemConfig.icon || 'help-circle';
    const properties = helpItemConfig.properties || {};

    processedHelpItem = {
      enabled: true,
      icon,
      scopes: helpItemConfig.scopes,
      properties: {
        label: properties.label || 'Report a Problem',
        prompt:
          properties.prompt ||
          "Please describe the problem you're experiencing. Let us know what you were trying to achieve and what happened instead.",
        title: properties.title,
        description:
          properties.description ||
          'Sending this request will include your name and email address so we can respond to you.',
        successMessage:
          properties.successMessage ||
          "Your request has been sent to the support team. We'll get back to you as soon as possible.",
      },
    };
  }

  // Update navigation with processed helpItem (only if defined)
  if (processedHelpItem) {
    clientNavigation = {
      ...clientNavigation,
      helpItem: processedHelpItem,
    };
  }

  // Create safe extension data that only includes capability flags and names
  const safeExtensionsData: Record<string, { name: string; capabilities: string[] }> = {};

  if (ctx.$config.app?.extensions) {
    Object.entries(ctx.$config.app.extensions).forEach(([name, config]) => {
      if (config && typeof config === 'object') {
        // Extract only the top-level boolean capability flags
        const capabilities: string[] = [];
        const knownCapabilities = [
          'dataModels',
          'inboundEmail',
          'navigation',
          'routes',
          'task',
          'workflows',
        ];

        knownCapabilities.forEach((capability) => {
          if ((config as any)[capability] === true) {
            capabilities.push(capability);
          }
        });

        // Special handling for inboundEmail which is an object
        if ((config as any).inboundEmail && typeof (config as any).inboundEmail === 'object') {
          capabilities.push('inboundEmail');
        }

        safeExtensionsData[name] = {
          name,
          capabilities,
        };
      }
    });
  }

  /*
   * WARNING - extending adding new config data to this object will expose it to the client
   * be very careful not to expose secrets
   */
  // Load authentication configuration
  const signupConfig = loadAndValidateSigninSignupConfig(ctx.$config);

  const clientSideConfig: ClientDeploymentConfig = strictObject<ClientDeploymentConfig>({
    name: ctx.$config.name ?? 'Unknown',
    editorApiUrl: ctx.$config.api?.editorApiUrl,
    renderServiceUrl: ctx.$config.app?.renderServiceUrl,
    fbClientConfig: ctx.$config.auth?.firebase?.clientConfig ?? undefined,
    authProviders,
    signupConfig: {
      signin: {
        mode: signupConfig.signin?.mode,
        preferred: signupConfig.signin?.preferred,
        prompt: signupConfig.signin?.prompt,
        alternativePrompt: signupConfig.signin?.alternativePrompt,
      },
      signup: {
        mode: signupConfig.signup?.mode,
        preferred: signupConfig.signup?.preferred,
        prompt: signupConfig.signup?.prompt,
        alternativePrompt: signupConfig.signup?.alternativePrompt,
        progressMessage: signupConfig.signup?.progressMessage,
        steps: signupConfig.signup?.steps,
      },
    },
    branding: {
      title: ctx.$config.app?.branding?.title,
      subtitle: ctx.$config.app?.branding?.subtitle,
      description: ctx.$config.app?.branding?.description,
      logo: ctx.$config.app?.branding?.logo,
      logoDark: ctx.$config.app?.branding?.logoDark,
      icon: ctx.$config.app?.branding?.icon,
      iconDark: ctx.$config.app?.branding?.iconDark,
      splash: ctx.$config.app?.branding?.splash,
      showLoginLink: ctx.$config.app?.branding?.showLoginLink,
      poweredBy: ctx.$config.app?.branding?.poweredBy,
      welcome: ctx.$config.app?.branding?.welcome,
      supportEmail: ctx.$config.app?.branding?.supportEmail,
    },
    statusBar: {
      reportProblem: {
        email: ctx.$config.app?.statusBar?.reportProblem?.email,
        subject: ctx.$config.app?.statusBar?.reportProblem?.subject,
      },
      // Type assertion is safe here - ItemElement and ClientStatusBarItem are structurally compatible
      // The schema types (ItemElement) match the client types (ClientStatusBarItem) by design
      items: ctx.$config.app?.statusBar?.items as ClientStatusBarItem[] | undefined,
    },
    navigation: clientNavigation as unknown as ClientDeploymentConfig['navigation'],
    strings: {
      app: {
        signupAdvice: ctx.$config.app?.strings?.signupAdvice,
        signupUrl: ctx.$config.app?.strings?.signupUrl,
        signupUrlText: ctx.$config.app?.strings?.signupUrlText,
      },
    },
    buildInfo: {
      version: packageJson.version,
    },
    extensions: safeExtensionsData,
  });

  /*
   * WARNING - extending this list of keys will expose them to the client
   * be very careful not to expose secrets
   */
  validateKeys<ClientDeploymentConfig>(clientSideConfig, [
    'name',
    'editorApiUrl',
    'renderServiceUrl',
    'fbClientConfig',
    'authProviders',
    'authProviders.*.provider',
    'authProviders.*.displayName',
    'authProviders.*.allowLogin',
    'authProviders.*.allowLinking',
    'authProviders.*.provisionNewUser',
    'authProviders.*.adminLogin',
    'authProviders.*.actionTitle',
    'signupConfig.signin.mode',
    'signupConfig.signin.preferred',
    'signupConfig.signin.prompt',
    'signupConfig.signin.alternativePrompt',
    'signupConfig.signup.mode',
    'signupConfig.signup.preferred',
    'signupConfig.signup.prompt',
    'signupConfig.signup.alternativePrompt',
    'signupConfig.signup.progressMessage',
    'signupConfig.signup.steps',
    'signupConfig.signup.steps.*.type',
    'signupConfig.signup.steps.*.title',
    'signupConfig.signup.steps.*.providers',
    'signupConfig.signup.steps.*.fields',
    'signupConfig.signup.steps.*.links',
    'signupConfig.signup.steps.*.links.*.label',
    'signupConfig.signup.steps.*.links.*.url',
    'signupConfig.signup.steps.*.alternativePrompts',
    'signupConfig.signup.steps.*.alternativePrompts.*.provider',
    'signupConfig.signup.steps.*.alternativePrompts.*.text',
    'signupConfig.signup.steps.*.skippable',
    'signupConfig.signup.steps.*.agreementUrls',
    'signupConfig.signup.steps.*.agreementUrls.*.label',
    'signupConfig.signup.steps.*.agreementUrls.*.url',
    'signupConfig.signup.approval.manual',
    'signupConfig.signup.approval.skipApproval',
    'branding.title',
    'branding.subtitle',
    'branding.description',
    'branding.logo',
    'branding.logoDark',
    'branding.icon',
    'branding.iconDark',
    'branding.favicon',
    'branding.splash',
    'branding.showLoginLink',
    'branding.poweredBy',
    'branding.supportEmail',
    'branding.welcome',
    'branding.welcome.title',
    'branding.welcome.tagline',
    'branding.welcome.description',
    'branding.welcome.showTasks',
    'branding.welcome.videos',
    'branding.welcome.videos.*.title',
    'branding.welcome.videos.*.url',
    'branding.welcome.videos.*.thumbnail',
    'statusBar.reportProblem.email',
    'statusBar.reportProblem.subject',
    'statusBar.items',
    'statusBar.items.*.name',
    'statusBar.items.*.type',
    'statusBar.items.*.position',
    'statusBar.items.*.properties.label',
    'statusBar.items.*.properties.email',
    'statusBar.items.*.properties.subject',
    'statusBar.items.*.properties.body',
    'statusBar.items.*.properties.successMessage',
    'statusBar.items.*.properties.prompt',
    'statusBar.items.*.properties.title',
    'statusBar.items.*.properties.description',
    'navigation',
    'navigation.defaultRoute',
    'navigation.items',
    'navigation.items.*.name',
    'navigation.items.*.label',
    'navigation.items.*.path',
    'navigation.items.*.scopes',
    'navigation.items.*.icon',
    'navigation.items.*.end',
    'navigation.items.*.beta',
    'navigation.helpItem',
    'navigation.helpItem.enabled',
    'navigation.helpItem.icon',
    'navigation.helpItem.scopes',
    'navigation.helpItem.scopes.*',
    'navigation.helpItem.properties',
    'navigation.helpItem.properties.label',
    'navigation.helpItem.properties.prompt',
    'navigation.helpItem.properties.title',
    'navigation.helpItem.properties.description',
    'navigation.helpItem.properties.successMessage',
    'strings.app.signupAdvice',
    'strings.app.signupUrl',
    'strings.app.signupUrlText',
    'buildInfo.version',
    'extensions.*.name',
    'extensions.*.capabilities',
  ]);

  if (ctx.user) {
    const url = new URL(args.request.url);
    if (url.pathname === '/') {
      // Don't redirect disabled or pending users to /app
      if (ctx.user.disabled || ctx.user.pending) {
        const user = formatMyUserDTO(ctx);
        return { theme, user, scopes: ctx.scopes, clientSideConfig };
      }
      return redirect('/app');
    }
    const user = formatMyUserDTO(ctx);
    return { theme, user, scopes: ctx.scopes, clientSideConfig };
  }

  return {
    theme,
    user: null,
    scopes: ctx.scopes,
    clientSideConfig,
  };
};

// Temporarily disabled middleware to work around Vercel deployment issue
// export const middleware: Route.MiddlewareFunction[] = [analyticsMiddleware];

// Component that handles navigation tracking - must be used inside MyUserProvider
function NavigationTracker() {
  useNavigationTracking();
  return null;
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { theme, user, scopes, clientSideConfig } = loaderData;
  NProgress.configure({ showSpinner: false });

  // TODO only initialize firebase if the auth provider is present
  useEffect(() => {
    if (clientSideConfig.fbClientConfig)
      initializeFirebase(JSON.parse(clientSideConfig.fbClientConfig));
  }, []);

  return (
    <html lang="en" className={cn(theme, 'h-full')}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-stone-50 text-stone-800 dark:text-stone-50 dark:bg-stone-800 min-w-[330px]">
        <DeploymentProvider config={clientSideConfig}>
          <ThemeProvider specifiedTheme={theme}>
            <MyUserProvider user={user} scopes={scopes}>
              <NavigationTracker />
              <Outlet />
              <ClientOnly>{() => <ui.Toaster />}</ClientOnly>
            </MyUserProvider>
          </ThemeProvider>
        </DeploymentProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body className="w-full h-screen">
        <GlobalErrorBoundary />
        <Scripts />
      </body>
    </html>
  );
}
