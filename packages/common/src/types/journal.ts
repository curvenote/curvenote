import type { SiteNavItem } from 'myst-config';

export interface ArticleThemeConfig {
  grid?: string;
  header?: 'minimal' | 'default';
  supportingDocuments?: boolean;
  tableOfContents?: boolean;
  documentOutline?: boolean;
  hideKeywords?: boolean;
  breadCrumbs?: boolean;
  subject?: string;
  jupyter?: JupyterUIThemeConfig & JupyterFeatureConfig;
}

export interface JupyterFeatureConfig {
  enable?: boolean;
  binderUrlOverride?: string;
  mecaBundle?: boolean;
  dedicatedHub?: {
    url: string;
    title: string;
    description?: string;
    icon?: string;
    clientProxyUrl: string;
  };
  allowLite?: boolean;
}

export interface JupyterUIThemeConfig {
  notebookCompute?: boolean;
  figureCompute?: boolean;
  launchBinder?: boolean;
  errorTray?: boolean;
}

export interface CTA {
  url: string;
  label: string;
  icon?: string;
  classes?: string;
  openInNewTab?: boolean;
}

export interface HeroConfig {
  title?: string;
  kicker?: string;
  tagline?: string;
  description?: string;
  backgroundImage?: string;
  layout?: 'center' | 'left';
  boxed?: boolean;
  classes?: {
    heading?: string;
    kicker?: string;
    tagline?: string;
    description?: string;
    text?: string;
    background?: string;
    backgroundScreen?: string;
  };
  cta?: CTA | CTA[];
}

export type FontConfig = {
  name: string;
  src: string;
};

export interface JournalThemeConfig {
  name: string; // theme name or if custom=true, the site.name
  title?: string;
  custom?: boolean; // if true, will not lookup based on url and will use the name as the site.name
  secure?: boolean; // true - whole site is behind login wall
  submission?: boolean; // if true - submission routes are available
  logo_url?: string;
  colors?: {
    primary?: string;
    secondary?: string;
  };
  fonts?: {
    one: FontConfig;
    two: FontConfig;
    three: FontConfig;
  };
  styles?: {
    body?: string;
    footer?: string;
    navitem?: string;
  };
  listing?: {
    enable?: boolean;
    type: 'cards' | 'list';
    title?: string;
    metaTitle?: string;
  };
  landing?: {
    grid?: string;
    floatingNav?: boolean;
    curvenoteTag?: boolean;
    headerHeight?: number;
    hero?: HeroConfig;
    listing?: 'cards' | 'list';
    numListingItems?: number;
    listingTitle?: string;
    listingActionText?: string;
    contentTitle?: string;
    documentOutline?: boolean;
    styles?: {
      navitem?: string;
    };
  };
  footer?: {
    brandFooter: 'curvenote' | 'curvenote-support' | 'curvenote-design' | 'stanford' | 'none';
    brandFooterText: string;
  };
  content?: {
    grid?: string;
    navigationBanner?: boolean;
    supportingDocuments?: boolean;
    tableOfContents?: boolean;
    documentOutline?: boolean;
  };
  articles?: ArticleThemeConfig & {
    byKind?: Record<string, ArticleThemeConfig>;
  };
  login?: {
    illustrationUrl?: string;
    heading?: string;
    subheading?: string;
  };
  jupyter?: JupyterFeatureConfig;
  defaults?: {
    subject?: string;
  };
  manifest?: {
    nav?: SiteNavItem[];
  };
}
