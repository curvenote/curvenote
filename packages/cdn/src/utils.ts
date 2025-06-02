import type { MinifiedOutput } from 'nbtx';
import { walkOutputs } from 'nbtx';
import type { SiteManifest } from 'myst-config';
import { selectAll } from 'unist-util-select';
import type { Image as ImageSpec, Link as LinkSpec } from 'myst-spec';
import type { FooterLinks, Heading, NavigationLink, PageLoader } from './types.js';
import { slugToUrl, type GenericParent } from 'myst-common';

type Image = ImageSpec & { urlOptimized?: string };
type Link = LinkSpec & { static?: boolean };
type Output = { data?: MinifiedOutput[] };

type ManifestProject = Required<SiteManifest>['projects'][0];
type ManifestProjectItem = ManifestProject['pages'][0];

export function getProject(
  config?: SiteManifest,
  projectSlug?: string,
): ManifestProject | undefined {
  if (!config) return undefined;
  if (!config.projects || config.projects.length === 0) return undefined;
  if (!projectSlug) return config.projects[0];
  const project = config.projects?.find((p) => p.slug === projectSlug) ?? config.projects[0];
  return project;
}

export function getProjectHeadings(
  config: SiteManifest,
  projectSlug?: string,
  opts: { addGroups: boolean } = { addGroups: false },
): Heading[] | undefined {
  const project = getProject(config, projectSlug);
  if (!project) return undefined;
  const headings: Heading[] = [
    {
      title: project.title,
      short_title: project.short_title,
      slug: project.index,
      path: project.slug ? `/${project.slug}` : '/',
      level: 'index',
      enumerator: project.enumerator,
    },
    ...project.pages.map((p) => {
      if (!('slug' in p)) return p;
      const slug = slugToUrl(p.slug);
      return {
        ...p,
        path: projectSlug && project.slug ? `/${project.slug}/${slug}` : `/${slug}`,
      };
    }),
  ];
  if (opts.addGroups) {
    let lastTitle = project.short_title || project.title;
    return headings.map((heading) => {
      if (!heading.slug || heading.level === 'index') {
        lastTitle = heading.short_title || heading.title;
      }
      return { ...heading, group: lastTitle };
    });
  }
  return headings;
}

function getHeadingLink(currentSlug: string, headings?: Heading[]): NavigationLink | undefined {
  if (!headings) return undefined;
  const linkIndex = headings.findIndex(({ slug }) => !!slug && slug !== currentSlug);
  const link = headings[linkIndex];
  if (!link?.path) return undefined;
  return {
    title: link.title,
    short_title: link.short_title,
    url: link.path,
    group: link.group,
  };
}

export function getFooterLinks(
  config?: SiteManifest,
  projectSlug?: string,
  slug?: string,
): FooterLinks {
  if (!slug || !config) return {};
  const pages = getProjectHeadings(config, projectSlug, {
    addGroups: true,
  });
  const found = pages?.findIndex(({ slug: s }) => s === slug) ?? -1;
  if (found === -1) return {};
  const prev = getHeadingLink(slug, pages?.slice(0, found).reverse());
  const next = getHeadingLink(slug, pages?.slice(found + 1));
  const footer: FooterLinks = {
    navigation: { prev, next },
  };
  return footer;
}

type UpdateUrl = (url: string) => string;

function updateMdastStaticLinksInplace(mdast: GenericParent, updateUrl: UpdateUrl) {
  // Fix all of the images to point to the CDN
  const images = selectAll('image', mdast) as Image[];
  images.forEach((node) => {
    node.url = updateUrl(node.url);
    if (node.urlOptimized) {
      node.urlOptimized = updateUrl(node.urlOptimized);
    }
  });
  const links = selectAll('link,linkBlock,card', mdast) as Link[];
  const staticLinks = links?.filter((node) => node.static);
  staticLinks.forEach((node) => {
    // These are static links to thinks like PDFs or other referenced files
    node.url = updateUrl(node.url);
  });
  const outputs = selectAll('output', mdast) as Output[];
  outputs.forEach((node) => {
    if (!node.data) return;
    walkOutputs(node.data, (obj) => {
      // The path will be defined from output of myst
      // Here we are re-assigning it to the current domain
      if (!obj.path) return;
      obj.path = updateUrl(obj.path);
    });
  });
}

export function updateSiteManifestStaticLinksInplace(
  data: SiteManifest,
  updateUrl: UpdateUrl,
): SiteManifest {
  data.actions?.forEach((action) => {
    if (!action.static) return;
    action.url = updateUrl(action.url);
  });
  // TODO: this needs to be based on the template.yml in the future
  // We have moved logo/logo_dark to options in v1.1.28
  data.options ??= {};
  if ((data as any).logo) {
    data.options.logo = (data as any).logo;
    delete (data as any).logo;
  }
  if ((data as any).logo_dark) {
    data.options.logo_dark = (data as any).logo_dark;
    delete (data as any).logo_dark;
  }
  if ((data as any).logoText) {
    data.options.logo_text = (data as any).logoText;
    delete (data as any).logoText;
  }
  if ((data as any).logo_text) {
    data.options.logo_text = (data as any).logo_text;
    delete (data as any).logo_text;
  }
  if ((data as any).twitter) {
    data.options.twitter = (data as any).twitter;
    delete (data as any).twitter;
  }
  if ((data as any).analytics_google) {
    data.options.analytics_google = (data as any).analytics_google;
    delete (data as any).analytics_google;
  }
  if ((data as any).analytics_plausible) {
    data.options.analytics_plausible = (data as any).analytics_plausible;
    delete (data as any).analytics_plausible;
  }
  if (data.options.logo) data.options.logo = updateUrl(data.options.logo);
  if (data.options.logo_dark) data.options.logo_dark = updateUrl(data.options.logo_dark);
  if (data.options.favicon) data.options.favicon = updateUrl(data.options.favicon);
  if (data.options.style) data.options.style = updateUrl(data.options.style);
  if (data.parts) {
    Object.values(data.parts).forEach(({ mdast }) => {
      updateMdastStaticLinksInplace(mdast, updateUrl);
    });
  }
  // Update the thumbnails to point at the CDN
  data.projects?.forEach((project) => {
    if (project.banner) project.banner = updateUrl(project.banner);
    if (project.bannerOptimized) project.bannerOptimized = updateUrl(project.bannerOptimized);
    if (project.thumbnail) project.thumbnail = updateUrl(project.thumbnail);
    if (project.thumbnailOptimized)
      project.thumbnailOptimized = updateUrl(project.thumbnailOptimized);
    if (project?.exports) {
      project.exports = project.exports.map((exp) => {
        if (!exp.url) return exp;
        return { ...exp, url: updateUrl(exp.url) };
      });
    }
    if (project?.downloads) {
      project.downloads = project.downloads.map((exp) => {
        if (!exp.url || !exp.static) return exp;
        return { ...exp, url: updateUrl(exp.url) };
      });
    }
    project.pages
      .filter((page): page is ManifestProjectItem => 'slug' in page)
      .forEach((page) => {
        if (page.thumbnail) page.thumbnail = updateUrl(page.thumbnail);
        if (page.thumbnailOptimized) page.thumbnailOptimized = updateUrl(page.thumbnailOptimized);
      });
    if (project.parts) {
      Object.values(project.parts).forEach(({ mdast }) => {
        updateMdastStaticLinksInplace(mdast, updateUrl);
      });
    }
  });
  return data;
}

export function updatePageStaticLinksInplace(data: PageLoader, updateUrl: UpdateUrl): PageLoader {
  if (data?.frontmatter?.thumbnail) {
    data.frontmatter.thumbnail = updateUrl(data.frontmatter.thumbnail);
  }
  if (data?.frontmatter?.thumbnailOptimized) {
    data.frontmatter.thumbnailOptimized = updateUrl(data.frontmatter.thumbnailOptimized);
  }
  if (data?.frontmatter?.banner) {
    data.frontmatter.banner = updateUrl(data.frontmatter.banner);
  }
  if (data?.frontmatter?.bannerOptimized) {
    data.frontmatter.bannerOptimized = updateUrl(data.frontmatter.bannerOptimized);
  }
  if (data?.frontmatter?.exports) {
    data.frontmatter.exports = data.frontmatter.exports.map((exp) => {
      if (!exp.url) return exp;
      return { ...exp, url: updateUrl(exp.url) };
    });
  }
  if (data?.frontmatter?.downloads) {
    data.frontmatter.downloads = data.frontmatter.downloads.map((exp) => {
      if (!exp.url || !exp.static) return exp;
      return { ...exp, url: updateUrl(exp.url) };
    });
  }
  const allMdastTrees = [data, ...Object.values(data.frontmatter?.parts ?? {})];
  allMdastTrees.forEach(({ mdast }) => {
    updateMdastStaticLinksInplace(mdast, updateUrl);
  });
  return data;
}

export function isFlatSite(config?: SiteManifest): boolean {
  return config?.projects?.length === 1 && !config.projects[0].slug;
}
