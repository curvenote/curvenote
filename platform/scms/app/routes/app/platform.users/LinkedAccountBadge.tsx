import * as React from 'react';
import { ui, useDeploymentConfig } from '@curvenote/scms-core';
import type { UserDTO } from './db.server';

type LinkedAccount = UserDTO['linkedAccounts'][0];

interface LinkedAccountBadgeProps {
  account: LinkedAccount;
}

function getProviderDisplayName(provider: string, authProviders: any[]): string {
  // First try to get display name from auth provider config
  const authProvider = authProviders.find((p) => p.provider === provider.toLowerCase());
  if (authProvider?.displayName) {
    return authProvider.displayName;
  }

  // Fallback to previous hardcoded mappings for providers not configured or missing displayName
  const fallbackDisplayNames: Record<string, string> = {
    orcid: 'ORCID',
    google: 'Google',
    github: 'GitHub',
    okta: 'Okta',
    firebase: 'Curvenote',
  };

  return (
    fallbackDisplayNames[provider.toLowerCase()] ||
    provider.charAt(0).toUpperCase() + provider.slice(1)
  );
}

function formatProfilePopover(account: LinkedAccount): React.ReactNode {
  if (!account.profile) {
    return (
      <>
        <p>No profile information available</p>
        {account.date_linked && (
          <p className="text-xs text-gray-500">
            Linked: {new Date(account.date_linked).toLocaleDateString()}
          </p>
        )}
      </>
    );
  }

  const profile = account.profile as any;
  const elements: React.ReactNode[] = [];

  // Add display name if available
  if (profile.display_name || profile.name) {
    elements.push(
      <div key="name">
        <span className="">Name:</span> {profile.display_name || profile.name}
      </div>,
    );
  }

  // Add email if available
  if (profile.email) {
    elements.push(
      <div key="email">
        <span className="">email:</span> {profile.email}
      </div>,
    );
  }

  // Add username if available
  if (profile.username) {
    elements.push(
      <div key="username">
        <span className="">Username:</span> {profile.username}
      </div>,
    );
  }

  // Add provider UID if available (but not for ORCID as it gets special handling below)
  if ((profile.id || profile.uid) && account.provider !== 'orcid') {
    elements.push(
      <div key="uid">
        <span className="">uid:</span> {profile.id ?? profile.uid}
      </div>,
    );
  }

  // Add ORCID ID for ORCID accounts
  if (account.provider === 'orcid' && profile.id) {
    elements.push(
      <div key="orcid">
        <span className="">ORCID ID:</span>{' '}
        <a
          href={`https://orcid.org/${profile.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {profile.id}
        </a>
      </div>,
    );
  }

  // Add linked date
  if (account.date_linked) {
    const date = new Date(account.date_linked);
    elements.push(
      <div key="linked" className="text-xs">
        Linked: {date.toLocaleDateString()}
      </div>,
    );
  }

  return <>{elements.length > 0 ? elements : <p>No profile information available</p>}</>;
}

export function LinkedAccountBadge({ account }: LinkedAccountBadgeProps) {
  const config = useDeploymentConfig();
  const displayName = getProviderDisplayName(account.provider, config.authProviders);
  const variant = 'outline';
  const label = account.pending ? `${displayName} (pending)` : displayName;
  const popoverContent = formatProfilePopover(account);

  return (
    <ui.Popover>
      <ui.PopoverTrigger asChild>
        <button className="cursor-pointer hover:opacity-80">
          <ui.Badge variant={variant}>{label}</ui.Badge>
        </button>
      </ui.PopoverTrigger>
      <ui.PopoverContent side="top" className="w-80">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{displayName} Account</h4>
          <div className="space-y-1 text-sm text-muted-foreground dark:text-foreground-muted">
            {popoverContent}
          </div>
        </div>
      </ui.PopoverContent>
    </ui.Popover>
  );
}
