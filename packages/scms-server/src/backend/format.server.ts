import type { SocialLink, FooterLink, Author } from '@curvenote/common';
import type { CheckDefinition } from '@curvenote/check-definitions';
import type { Context } from './context.server.js';
import type { MyUserWithAccountsDTO } from '@curvenote/scms-core';
import { error404 } from '@curvenote/scms-core';

export function formatFooterLinks(footer_links?: FooterLink[][]): FooterLink[][] | undefined {
  const formatted = footer_links?.map((links: FooterLink[]): FooterLink[] =>
    links.map((link) => ({ title: link.title, url: link.url, external: link.external })),
  );
  if (!formatted || formatted.length === 0) return undefined;
  return formatted;
}

export function formatSocialLinks(social_links?: SocialLink[]): SocialLink[] | undefined {
  const formatted = social_links?.map(
    (link: SocialLink): SocialLink => ({ kind: link.kind, url: link.url }),
  );
  if (!formatted || formatted.length === 0) return undefined;
  return formatted;
}

export function formatAuthorDTO(author: string): Author {
  return { name: author };
}

export function formatMyUserDTO(ctx: Context): MyUserWithAccountsDTO {
  const { user } = ctx;
  if (!user) throw error404('User not found');
  return {
    id: user.id,
    email: user.email ?? undefined,
    display_name: user.display_name ?? '',
    system_role: user.system_role,
    site_roles: user.site_roles.map(({ site, role }) => ({
      site: {
        name: site.name,
        title: site.title,
        id: site.id,
      },
      role,
    })),
    linkedAccounts: user.linkedAccounts?.map((account) => ({
      id: account.id,
      provider: account.provider,
      idAtProvider: account.idAtProvider,
      email: account.email,
      profile: account.profile,
      pending: account.pending,
      date_linked: account.date_linked,
    })),
    links: {
      self: ctx.asApiUrl('/my/user'),
    },
  };
}

export function formatCheckDTO(ctx: Context, check: CheckDefinition) {
  return {
    ...check,
    links: {
      self: ctx.asApiUrl(`/checks/${check.id}`),
    },
  };
}

export function formatChecksDTO(ctx: Context, checks: CheckDefinition[]) {
  return {
    items: checks.map((check) => formatCheckDTO(ctx, check)),
    links: {
      self: ctx.asApiUrl('/checks'),
    },
  };
}
