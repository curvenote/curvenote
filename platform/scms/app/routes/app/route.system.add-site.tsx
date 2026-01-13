import type { Route } from './+types/route.system.add-site';
import { data, useFetcher } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { withAppAdminContext, sites } from '@curvenote/scms-server';
import {
  SystemAdminBadge,
  ui,
  primitives,
  useEditor,
  coerceToObject,
  PageFrame,
} from '@curvenote/scms-core';
import type { JournalThemeConfig, SiteConfig } from '@curvenote/common';
import { dump, load } from 'js-yaml';

type SiteConfigWithCollections = SiteConfig & {
  kinds: sites.KindConfig[];
  collections?: sites.CollectionConfig[];
};

const DEFAULT_SITE_CONFIG: { theme_config: Omit<JournalThemeConfig, 'secure'> } & Record<
  string,
  any
> = {
  name: '<SITE-NAME>',
  default_workflow: 'SIMPLE',
  title: '<TITLE>',
  submission_cdn: 'https://prv.curvenote.dev/',
  description: '<META-DESCRIPTION>',
  favicon: 'https://cdn.curvenote.com/static/site/curvenote/favicon.ico',
  tagline: '',
  content: 'curvenote-landing.curve.space/',
  logo: 'https://cdn.curvenote.com/static/site/curvenote/logo-icon-blue.svg',
  logo_dark: 'https://cdn.curvenote.com/static/site/curvenote/logo-icon-white.svg',
  footer_logo: 'https://cdn.curvenote.com/static/site/curvenote/logo-text-white.svg',
  footer_logo_dark: 'https://cdn.curvenote.com/static/site/curvenote/logo-text-blue.svg',
  footer_links: [
    [
      {
        url: '/',
        title: 'Home',
      },
      {
        url: '/articles',
        title: 'Latest Research',
      },
    ],
  ],
  social_links: [
    { kind: 'github', url: 'https://github.com/curvenote' },
    { kind: 'twitter', url: 'https://twitter.com/@curvenote' },
    { kind: 'website', url: 'https://curvenote.com/' },
  ],
  kinds: [
    {
      name: 'article',
      content: {
        title: 'Article',
        description: 'A research article',
      },
      default: true,
      checks: [],
    },
  ],
  collections: [
    {
      name: 'articles',
      slug: 'articles',
      workflow: 'SIMPLE',
      kinds: ['article'],
      content: {
        title: 'Articles',
        description: 'A collection of research articles',
      },
      open: true,
      default: true,
    },
  ],
  theme_config: {
    name: 'theme-one',
    colors: {
      primary: '#0154a4',
      secondary: '#616161',
    },
    styles: {
      footer: 'bg-primary dark:bg-stone-700 text-primary-contrast',
    },
    content: {
      tableOfContents: true,
      navigationBanner: false,
    },
    jupyter: {
      mecaBundle: true,
      binderUrlOverride: 'https://xhrtcvh6l53u.curvenote.dev/services/binder/',
    },
    landing: {
      grid: 'article-left-grid',
      hero: {
        title: '<HERO-TITLE>',
        tagline: '<HERO-TAGLINE>',
        description: '<HERO-DESCRIPTION>',
        backgroundImage: 'https://<BACKGROUND-IMAGE>',
        cta: [
          {
            url: '<URL>',
            label: '<CTA-LABEL>',
            classes:
              'p-3 no-underline border rounded text-secondary-contrast bg-secondary shadow-white/30 hover:shadow-white/50 hover:underline w-fit',
            openInNewTab: false,
          },
        ],
        layout: 'left',
        classes: {
          text: 'text-primary-contrast text-xl font-light',
          heading: 'text-primary-contrast text-5xl',
          tagline: 'text-2xl mt-0 font-extralight',
          description: undefined,
          background: 'bg-left',
          backgroundScreen: 'bg-black bg-opacity-50 lg:hidden',
        },
      },
      listing: 'list',
      numListingItems: 3,
      documentOutline: true,
      listingTitle: 'Latest Articles',
      listingActionText: 'See All Articles',
    },
    listing: {
      type: 'list',
      title: 'All Articles',
    },
    articles: {
      grid: 'article-left-grid',
      documentOutline: true,
      tableOfContents: false,
      supportingDocuments: true,
      jupyter: {
        launchBinder: true,
        figureCompute: true,
        notebookCompute: true,
      },
    },
    manifest: {
      nav: [{ title: 'Articles', url: '/articles' }],
    },
    submission: false,
  },
};

// Helper function to determine the complexity of a value
function getValueComplexity(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value !== 'object') return 0; // primitives (string, number, boolean)
  if (Array.isArray(value)) return 2;
  if (typeof value === 'object') return 1;
  return 3; // fallback for other types
}

// Priority order for top-level fields
const PRIORITY_FIELDS = [
  'name',
  'title',
  'description',
  'tagline',
  'default_workflow',
  'kinds',
  'collections',
];

// Custom sorting function for YAML keys
function sortKeys(a: string, b: string, obj: any): number {
  // First check if either key is in the priority list
  const aPriority = PRIORITY_FIELDS.indexOf(a);
  const bPriority = PRIORITY_FIELDS.indexOf(b);

  // If both are in priority list, sort by priority order
  if (aPriority !== -1 && bPriority !== -1) {
    return aPriority - bPriority;
  }
  // If only one is in priority list, it should come first
  if (aPriority !== -1) return -1;
  if (bPriority !== -1) return 1;

  // For non-priority fields, sort by complexity
  const aValue = obj[a];
  const bValue = obj[b];
  const aComplexity = getValueComplexity(aValue);
  const bComplexity = getValueComplexity(bValue);

  // First sort by complexity
  if (aComplexity !== bComplexity) {
    return aComplexity - bComplexity;
  }

  // Then sort alphabetically
  return a.localeCompare(b);
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppAdminContext(args);
  const formData = await args.request.formData();

  const secure = formData.get('is_private') === 'on';
  const external = formData.get('is_external') === 'on';
  const hostname = formData.get('hostname') as string;
  const new_site = formData.get('new_site');
  if (typeof new_site !== 'string') {
    return data({ error: { submit: 'Invalid site configuration data' } }, { status: 400 });
  }
  const newSite = coerceToObject(JSON.parse(new_site)) as SiteConfigWithCollections &
    Record<string, any>;
  const { kinds, collections, ...siteConfig } = newSite;
  siteConfig.private = secure;
  siteConfig.external = external;
  siteConfig.restricted = true;

  const response = await sites.dbCreateSite(ctx, {
    hostname,
    kinds,
    collections,
    siteConfig,
  });

  return response;
}

export default function AddSite() {
  const fetcher = useFetcher<typeof action>();

  const [isExternal, setIsExternal] = useState(false);
  const { doc, ref, view } = useEditor(
    dump(DEFAULT_SITE_CONFIG, {
      sortKeys: (a, b) => sortKeys(a, b, DEFAULT_SITE_CONFIG),
    }),
    'yaml',
  );
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!view) return;

    let siteData: Record<string, any> | undefined;
    try {
      const yamlData = load(view.state.doc.toString());
      if (typeof yamlData !== 'object' || yamlData === null) {
        throw new Error('Invalid YAML structure');
      }
      siteData = yamlData as Record<string, any>;
    } catch {
      ui.toastError('Invalid YAML format');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const hostname = formData.get('hostname');
    const is_private = formData.get('is_private') ? 'on' : 'off';
    const is_external = formData.get('is_external') ? 'on' : 'off';

    if (!isExternal && typeof hostname !== 'string') {
      ui.toastError('Invalid hostname');
      return;
    }

    if (confirm(`Are you sure you want to create a new site called "${siteData?.name}"?`)) {
      const fd = new FormData();
      fd.append('hostname', hostname || '');
      fd.append('is_private', is_private);
      fd.append('is_external', is_external);
      fd.append('new_site', JSON.stringify(siteData));
      fetcher.submit(fd, { method: 'post' });
      return;
    }
  }

  const reset = () => {
    formRef.current?.reset();
    setIsExternal(false);
    view?.dispatch({
      changes: {
        from: 0,
        to: view?.state.doc.length ?? 0,
        insert: doc,
      },
    });
  };

  useEffect(
    function resetFormOnSuccess() {
      if (
        fetcher.state === 'idle' &&
        fetcher.data &&
        'success' in fetcher.data &&
        fetcher.data.success
      ) {
        ui.toastSuccess('Site created successfully!');
        reset();
      }
    },
    [fetcher.state, fetcher.data],
  );

  useEffect(
    function showErrorToast() {
      if (
        fetcher.state === 'idle' &&
        fetcher.data &&
        'error' in fetcher.data &&
        fetcher.data.error
      ) {
        const errorMsg =
          ('submit' in fetcher.data.error && fetcher.data.error.submit) ||
          ('hostname' in fetcher.data.error && fetcher.data.error.hostname) ||
          'An error occurred while creating the site';
        ui.toastError(errorMsg);
      }
    },
    [fetcher.state, fetcher.data],
  );

  return (
    <PageFrame title="Add a new Site">
      <div>
        <SystemAdminBadge />

        <fetcher.Form ref={formRef} method="POST" onSubmit={handleSubmit}>
          <div className="max-w-[1024px] flex flex-col space-y-4 my-4">
            <primitives.Card className="p-6 space-y-4" validateUsing={fetcher}>
              <h2>Add a new site</h2>
              <p className="text-sm font-light text-muted-foreground">
                Initial site configuration is done by submitting the following YAML object. This is
                one shot, please make sure the info is correct. Any edits will need to be done
                manually.
              </p>

              <div className="flex flex-col gap-4 py-2 lg:w-1/2">
                <div className="flex items-center space-x-2">
                  <ui.Checkbox
                    id="create.private"
                    name="is_private"
                    value="on"
                    disabled={fetcher.state === 'submitting'}
                  />
                  <label htmlFor="create.private" className="text-sm">
                    Make the Site Private?
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <ui.Checkbox
                    id="create.external"
                    name="is_external"
                    value="on"
                    defaultChecked={false}
                    disabled={fetcher.state === 'submitting'}
                    onCheckedChange={(checked) => setIsExternal(checked as boolean)}
                  />
                  <label htmlFor="create.external" className="text-sm">
                    Make the Site External?
                  </label>
                </div>
                <div className="space-y-2">
                  <label htmlFor="hostname" className="text-sm">
                    Enter Hostname
                  </label>
                  <ui.Input
                    id="hostname"
                    name="hostname"
                    placeholder="newsite.curve.space"
                    required={!isExternal}
                    disabled={isExternal || fetcher.state === 'submitting'}
                  />
                  {fetcher.data &&
                    'error' in fetcher.data &&
                    fetcher.data.error &&
                    'hostname' in fetcher.data.error &&
                    fetcher.data.error.hostname && (
                      <p className="text-sm text-red-600">{fetcher.data.error.hostname}</p>
                    )}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <ui.Button
                  type="button"
                  variant="secondary"
                  disabled={fetcher.state === 'loading' || fetcher.state === 'submitting'}
                  onClick={reset}
                >
                  Reset
                </ui.Button>
                <ui.Button
                  type="submit"
                  disabled={fetcher.state === 'loading' || fetcher.state === 'submitting'}
                  variant="default"
                >
                  {fetcher.state === 'submitting' ? 'Creating...' : 'Create'}
                </ui.Button>
              </div>

              <div className="relative">
                <div
                  ref={ref}
                  className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </primitives.Card>
          </div>
        </fetcher.Form>
      </div>
    </PageFrame>
  );
}
