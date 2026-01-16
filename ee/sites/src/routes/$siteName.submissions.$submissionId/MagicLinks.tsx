import { useFetcher, useLoaderData } from 'react-router';
import { useState, useEffect } from 'react';
import {
  formatDate,
  primitives,
  SectionWithHeading,
  ui,
  clientCheckSiteScopes,
  scopes,
} from '@curvenote/scms-core';
import {
  Link2,
  Copy,
  XCircle,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import classNames from 'classnames';
import type { MagicLink } from '@curvenote/scms-db';
import { DeleteMagicLinkDialog } from './DeleteMagicLinkDialog.js';
import { ConfirmMagicLinkActionDialog } from './ConfirmMagicLinkActionDialog.js';
import type { SiteWithAppData } from '../../backend/db.server.js';

interface MagicLinkWithCount extends MagicLink {
  access_count: number;
}

interface LoaderData {
  userScopes: string[];
  site: { name: string };
  siteWithAppData: SiteWithAppData;
  magicLinks?: MagicLinkWithCount[];
}

export function MagicLinks() {
  const { userScopes, site, siteWithAppData, magicLinks = [] } = useLoaderData() as LoaderData;
  const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<{ id: string; label?: string } | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [linkAction, setLinkAction] = useState<{
    id: string;
    label?: string;
    action: 'revoke' | 'reactivate';
  } | null>(null);

  const canUpdate = clientCheckSiteScopes(userScopes, [scopes.site.submissions.update], site.name);
  const magicLinksEnabled = siteWithAppData.data?.magicLinksEnabled ?? false;
  const [hasHandledSuccess, setHasHandledSuccess] = useState(false);

  // Handle fetcher errors and success with toast notifications
  useEffect(() => {
    if (!hasHandledSuccess && fetcher.data?.success && fetcher.state === 'idle') {
      setHasHandledSuccess(true);
      ui.toastSuccess('Magic link created successfully');
      // Close form on success
      setShowForm(false);
      setShowAdvanced(false);
    } else if (fetcher.data?.error && fetcher.state === 'idle') {
      ui.toastError(fetcher.data.error);
      // Keep form open on error so user can fix it
    }
  }, [fetcher.data, fetcher.state, hasHandledSuccess]);

  // Reset success handling state when form opens/closes
  useEffect(() => {
    if (!showForm) {
      setHasHandledSuccess(false);
    }
  }, [showForm]);

  // Don't show if user can't update or if feature is disabled
  if (!canUpdate || !magicLinksEnabled) {
    return null;
  }

  const handleCopyLink = (linkId: string) => {
    const url = `${apiBaseUrl}/v1/magic/${linkId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const handleRevoke = (linkId: string, label?: string) => {
    setLinkAction({ id: linkId, label, action: 'revoke' });
    setActionDialogOpen(true);
  };

  const handleReactivate = (linkId: string, label?: string) => {
    setLinkAction({ id: linkId, label, action: 'reactivate' });
    setActionDialogOpen(true);
  };

  const handleDeleteClick = (linkId: string, label?: string) => {
    setLinkToDelete({ id: linkId, label });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = () => {
    // Dialog will close automatically on success
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasHandledSuccess(false);
    const formData = new FormData(e.currentTarget);
    formData.append('formAction', 'magic-link-create');
    fetcher.submit(formData, { method: 'POST' });
    // Don't close form immediately - wait for success/error response
  };

  const getLinkStatus = (link: MagicLinkWithCount) => {
    if (link.revoked) {
      return { label: 'Revoked', color: 'text-red-600', icon: XCircle };
    }
    if (link.expiry && new Date(link.expiry) < new Date()) {
      return { label: 'Expired', color: 'text-orange-600', icon: Clock };
    }
    if (link.access_limit && link.access_count >= link.access_limit) {
      return { label: 'Limit Reached', color: 'text-orange-600', icon: AlertCircle };
    }
    return { label: 'Active', color: 'text-green-600', icon: CheckCircle2 };
  };

  return (
    <SectionWithHeading heading="Access Links" icon={Link2}>
      <primitives.Card lift className="p-8">
        <div className="space-y-4">
          <div className="flex gap-4 justify-between items-start">
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Create secure, time-limited links to share this submission with reviewers or
                collaborators. These links provide access to the latest active version of the
                submission (e.g., pending review or published), allowing recipients to view content
                without requiring an account.
              </p>
            </div>
            {!showForm && (
              <ui.Button onClick={() => setShowForm(true)} size="sm" variant="outline">
                <Plus className="w-4 h-4" />
                Create Link
              </ui.Button>
            )}
          </div>

          {showForm && (
            <fetcher.Form onSubmit={handleSubmit} className="p-4 space-y-4 bg-gray-50 rounded-md">
              <div className="space-y-2">
                <ui.Label htmlFor="name">Link Label (optional)</ui.Label>
                <ui.Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g., Reviewer 1, Editorial Board, etc."
                />
                <p className="text-xs text-gray-500">
                  A descriptive label to help you identify this link
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex gap-2 items-center text-sm text-gray-700 hover:text-gray-900"
                >
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Advanced Options
                </button>
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <ui.Label htmlFor="email">Email (optional)</ui.Label>
                    <ui.Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="reviewer@example.com"
                    />
                    <p className="text-xs text-gray-500">For tracking purposes only</p>
                  </div>
                  <div className="space-y-2">
                    <ui.Label htmlFor="expiryDuration">Expires In</ui.Label>
                    <ui.Select name="expiryDuration" defaultValue="0">
                      <ui.SelectTrigger>
                        <ui.SelectValue placeholder="Select duration" />
                      </ui.SelectTrigger>
                      <ui.SelectContent>
                        <ui.SelectItem value="86400000">1 Day</ui.SelectItem>
                        <ui.SelectItem value="604800000">7 Days</ui.SelectItem>
                        <ui.SelectItem value="2592000000">30 Days</ui.SelectItem>
                        <ui.SelectItem value="7776000000">90 Days</ui.SelectItem>
                        <ui.SelectItem value="0">Never</ui.SelectItem>
                      </ui.SelectContent>
                    </ui.Select>
                  </div>
                  <div className="space-y-2">
                    <ui.Label htmlFor="accessLimit">Access Limit</ui.Label>
                    <ui.Input
                      id="accessLimit"
                      name="accessLimit"
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                    />
                    <p className="text-xs text-gray-500">Maximum successful accesses</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <ui.Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setShowAdvanced(false);
                  }}
                >
                  Cancel
                </ui.Button>
                <ui.Button type="submit" size="sm" disabled={fetcher.state === 'submitting'}>
                  {fetcher.state === 'submitting' ? 'Creating...' : 'Create Link'}
                </ui.Button>
              </div>
            </fetcher.Form>
          )}

          {magicLinks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Existing Links ({magicLinks.length})</h3>
              {magicLinks.map((link) => {
                const data = link.data as any;
                const status = getLinkStatus(link);
                const StatusIcon = status.icon;
                const url = `${apiBaseUrl}/v1/magic/${link.id}`;
                const isCopied = copiedLinkId === link.id;

                return (
                  <div
                    key={link.id}
                    className={classNames(
                      'border rounded-md p-3 md:p-4',
                      link.revoked ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200',
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <StatusIcon className={classNames('w-4 h-4', status.color)} />
                        <span className={classNames('text-sm font-medium', status.color)}>
                          {status.label}
                        </span>
                        {data.name && <span className="text-sm text-gray-600">• {data.name}</span>}
                      </div>

                      {/* Metadata on same line for wide screens */}
                      <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-gray-500">
                        {data.email && (
                          <span>
                            <span className="font-medium">Email:</span> {data.email}
                          </span>
                        )}
                        <span>Created {formatDate(link.date_created, 'MMM dd, y')}</span>
                        {link.expiry && <span>Expires {formatDate(link.expiry, 'MMM dd, y')}</span>}
                        <span>
                          {link.access_count} access{link.access_count !== 1 ? 'es' : ''}
                          {link.access_limit && ` / ${link.access_limit} max`}
                        </span>
                      </div>

                      {/* Link URL with inline copy and revoke/reactivate buttons */}
                      {link.revoked ? (
                        <div className="flex gap-2 items-center">
                          <code className="flex-1 px-2 py-1 text-xs text-gray-400 truncate bg-gray-50 rounded border border-gray-200 opacity-60">
                            {url}
                          </code>
                          <ui.Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReactivate(link.id, data.name)}
                            className="shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Reactivate
                          </ui.Button>
                          <ui.Button
                            size="icon-sm"
                            variant="action"
                            onClick={() => handleDeleteClick(link.id, data.name)}
                            className="text-red-600 shrink-0 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Delete</span>
                          </ui.Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <code className="flex-1 px-2 py-1 text-xs text-gray-600 truncate bg-gray-100 rounded">
                            {url}
                          </code>
                          <ui.Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyLink(link.id)}
                            className="shrink-0"
                          >
                            {isCopied ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                                <span className="ml-1">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="ml-1">Copy</span>
                              </>
                            )}
                          </ui.Button>
                          <ui.Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevoke(link.id, data.name)}
                            className="shrink-0"
                          >
                            <XCircle className="w-4 h-4" />
                            Revoke
                          </ui.Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!showForm && magicLinks.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              <Link2 className="mx-auto mb-3 w-12 h-12 opacity-50" />
              <p>No magic links created yet</p>
              <p className="text-sm">Create a link to share this submission securely</p>
            </div>
          )}
        </div>
      </primitives.Card>
      {linkToDelete && (
        <DeleteMagicLinkDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setLinkToDelete(null);
          }}
          linkId={linkToDelete.id}
          linkLabel={linkToDelete.label}
          onDeleted={handleDeleteConfirmed}
        />
      )}

      {linkAction && (
        <ConfirmMagicLinkActionDialog
          isOpen={actionDialogOpen}
          onClose={() => {
            setActionDialogOpen(false);
            setLinkAction(null);
          }}
          linkId={linkAction.id}
          linkLabel={linkAction.label}
          action={linkAction.action}
          onConfirmed={() => {
            ui.toastSuccess(
              linkAction.action === 'revoke'
                ? 'Access link revoked successfully'
                : 'Access link reactivated successfully',
            );
          }}
        />
      )}
    </SectionWithHeading>
  );
}
