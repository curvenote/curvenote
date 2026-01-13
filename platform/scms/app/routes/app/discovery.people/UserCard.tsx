import { primitives, ui, formatDate } from '@curvenote/scms-core';
import { Star, Mail, Building2 } from 'lucide-react';
import type { SystemRole } from '@prisma/client';

type User = {
  id: string;
  date_created: string;
  email: string | null;
  username: string | null;
  primaryProvider: string | null;
  display_name: string | null;
  system_role: SystemRole;
  site_roles: Array<{
    id: string;
    date_created: string;
    role: string;
    site_id: string;
    user_id: string;
    site: {
      id: string;
      name: string;
      title: string;
    };
  }>;
  linkedAccounts: Array<{
    id: string;
    provider: string;
    date_linked: string | null;
    pending: boolean;
    profile: any;
    idAtProvider: string | null;
  }>;
};

function getOrcidId(account: User['linkedAccounts'][0]): string | null {
  if (account.provider === 'orcid' && account.idAtProvider) {
    return account.idAtProvider;
  }
  return null;
}

function getCompanyFromProfile(user: User): string | null {
  // Check linked accounts for company information
  for (const account of user.linkedAccounts) {
    if (account.profile && typeof account.profile === 'object') {
      // Common fields where company info might be stored
      const company =
        account.profile.company ||
        account.profile.organization ||
        account.profile.institution ||
        account.profile.affiliation;

      if (company && typeof company === 'string') {
        return company;
      }
    }
  }
  return null;
}

export function UserCard({ user }: { user: User }) {
  const displayName = user.display_name || user.username || user.email || 'Unknown User';
  const isSystemAdmin = user.system_role === 'ADMIN';
  const joinDate = formatDate(user.date_created);
  const company = getCompanyFromProfile(user);

  return (
    <primitives.Card lift className="p-6 space-y-4">
      {/* Name and Admin Star */}
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">
          {displayName}
        </h3>
        {isSystemAdmin && (
          <Star
            className="flex-shrink-0 w-5 h-5 ml-2 text-yellow-500 fill-current"
            aria-label="System Admin"
          />
        )}
      </div>

      {/* Email */}
      {user.email && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Mail className="flex-shrink-0 w-4 h-4" />
          <span className="truncate">{user.email}</span>
        </div>
      )}

      {/* Company/Affiliation */}
      {company && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Building2 className="flex-shrink-0 w-4 h-4" />
          <span className="truncate">{company}</span>
        </div>
      )}

      {/* Join Date */}
      <div className="text-sm text-gray-500 dark:text-gray-500">Joined {joinDate}</div>

      {/* Linked Accounts */}
      {user.linkedAccounts.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-gray-700 uppercase dark:text-gray-300">
            Linked Accounts
          </div>
          <div className="flex flex-wrap gap-1">
            {user.linkedAccounts.map((account) => {
              const orcidId = getOrcidId(account);
              const title = orcidId
                ? `ORCID ID: ${orcidId}`
                : account.idAtProvider || `${account.provider} account`;

              return (
                <ui.Badge
                  key={account.id}
                  variant={account.pending ? 'secondary' : 'default'}
                  className="text-xs"
                  title={title}
                >
                  {account.provider}
                  {account.pending && ' (pending)'}
                </ui.Badge>
              );
            })}
          </div>
        </div>
      )}
    </primitives.Card>
  );
}
