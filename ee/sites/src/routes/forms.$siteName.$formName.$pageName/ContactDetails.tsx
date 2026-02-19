import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { ui, orcid } from '@curvenote/scms-core';
import { useSaveField } from './useSaveField.js';
import { isValidEmail, isValidOrcid } from './validationUtils.js';

type ContactDetailsUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
};

type ContactDetailsProps = {
  user: ContactDetailsUser | null;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
  draftContactName?: string;
  draftContactEmail?: string;
  draftContactOrcidId?: string;
  /** Called when contact fields change so parent can sync. */
  onContactChange?: (updates: {
    contactName?: string;
    contactEmail?: string;
    contactOrcidId?: string;
  }) => void;
};

export function ContactDetails({
  user,
  draftObjectId = null,
  onDraftCreated,
  draftContactName = '',
  draftContactEmail = '',
  draftContactOrcidId = '',
  onContactChange,
}: ContactDetailsProps) {
  const orcidFetcher = useFetcher();
  const linkOrcidResponse = orcidFetcher.data as
    | { linkOrcid?: boolean; returnTo?: string }
    | undefined;
  const didRedirectRef = useRef(false);

  const [name, setName] = useState(user?.name ?? draftContactName ?? '');
  const [email, setEmail] = useState(user?.email ?? draftContactEmail ?? '');
  const [orcidId, setOrcidId] = useState(user?.orcid ?? draftContactOrcidId ?? '');

  const saveName = useSaveField(draftObjectId ?? null, 'contactName', onDraftCreated);
  const saveEmail = useSaveField(draftObjectId ?? null, 'contactEmail', onDraftCreated);
  const saveOrcidId = useSaveField(draftObjectId ?? null, 'contactOrcidId', onDraftCreated);

  // Allow redirect again when user submits the form again (e.g. retry after error)
  useEffect(() => {
    if (orcidFetcher.state === 'submitting') {
      didRedirectRef.current = false;
    }
  }, [orcidFetcher.state]);

  // Sync from user (OAuth) or draft when those change; user takes precedence
  useEffect(() => {
    setName(user?.name ?? draftContactName ?? '');
    setEmail(user?.email ?? draftContactEmail ?? '');
    setOrcidId(user?.orcid ?? draftContactOrcidId ?? '');
  }, [
    user?.name,
    user?.email,
    user?.orcid,
    draftContactName,
    draftContactEmail,
    draftContactOrcidId,
  ]);

  const currentUrl =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  const isLoggedIn = !!user;
  // Disable each field only when its value came from OAuth/account (user may not have all fields)
  const nameReadOnly = isLoggedIn && user?.name != null && user.name !== '';
  const emailReadOnly = isLoggedIn && user?.email != null && user.email !== '';
  const orcidReadOnly = isLoggedIn && user?.orcid != null && user.orcid !== '';
  const allFromUser = nameReadOnly && emailReadOnly && orcidReadOnly;

  // Handle ORCID linking: after pending account is created, POST to /auth/orcid (same as forms)
  useEffect(() => {
    if (!linkOrcidResponse?.linkOrcid || !linkOrcidResponse.returnTo || didRedirectRef.current) {
      return;
    }
    didRedirectRef.current = true;
    const authForm = document.createElement('form');
    authForm.method = 'POST';
    authForm.action = `/auth/orcid?returnTo=${encodeURIComponent(linkOrcidResponse.returnTo)}`;
    document.body.appendChild(authForm);
    authForm.submit();
  }, [linkOrcidResponse?.linkOrcid, linkOrcidResponse?.returnTo]);

  if (allFromUser) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground">
        {name.trim() && <span className="font-medium">{name.trim()}</span>}
        {email.trim() && <span className="text-muted-foreground">{email.trim()}</span>}
        {orcidId.trim() && isValidOrcid(orcidId) && (
          <span className="text-muted-foreground tabular-nums">{orcidId.trim()}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-6 items-center">
        <div className="flex flex-col flex-1 gap-4 min-w-0">
          <div className="space-y-2">
            <ui.FormLabel
              htmlFor="contact-name"
              required
              valid={name.trim().length > 0}
              defined={name.trim().length > 0}
            >
              Your Name
            </ui.FormLabel>
            <ui.Input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                if (!nameReadOnly) saveName(v);
                onContactChange?.({ contactName: v, contactEmail: email, contactOrcidId: orcidId });
              }}
              placeholder="Full name"
              className="w-full"
              disabled={nameReadOnly}
            />
          </div>
          <div className="space-y-2">
            <ui.FormLabel
              htmlFor="contact-email"
              required
              valid={isValidEmail(email)}
              defined={email.trim().length > 0}
            >
              Email
            </ui.FormLabel>
            <ui.Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => {
                const v = e.target.value;
                setEmail(v);
                if (!emailReadOnly) saveEmail(v);
                onContactChange?.({ contactName: name, contactEmail: v, contactOrcidId: orcidId });
              }}
              placeholder="you@example.com"
              className="w-full"
              disabled={emailReadOnly}
            />
          </div>
          <div className="space-y-2">
            <ui.FormLabel
              htmlFor="contact-orcid"
              required={false}
              valid={isValidOrcid(orcidId)}
              defined={orcidId.trim().length > 0}
            >
              ORCID ID
            </ui.FormLabel>
            <ui.Input
              id="contact-orcid"
              type="text"
              value={orcidId}
              onChange={(e) => {
                const v = e.target.value;
                setOrcidId(v);
                if (!orcidReadOnly) saveOrcidId(v);
                onContactChange?.({ contactName: name, contactEmail: email, contactOrcidId: v });
              }}
              placeholder="0000-0000-0000-0000"
              className="w-full"
              disabled={orcidReadOnly}
            />
          </div>
        </div>
        {!user?.orcid && (
          <div className="flex items-center shrink-0">
            {isLoggedIn ? (
              <orcidFetcher.Form method="post" className="w-full">
                <input type="hidden" name="intent" value="link-orcid" />
                <ui.StatefulButton
                  variant="outline"
                  type="submit"
                  disabled={orcidFetcher.state !== 'idle'}
                  busy={orcidFetcher.state !== 'idle'}
                  overlayBusy
                  className="h-10 bg-[#a6ce39] text-white border-[#a6ce39] hover:bg-[#a6ce39]/90 hover:text-white"
                >
                  <span className="flex gap-2 items-center">
                    Auto-fill with <orcid.Badge size={18} white />
                  </span>
                </ui.StatefulButton>
              </orcidFetcher.Form>
            ) : (
              <orcidFetcher.Form
                method="post"
                action={`/auth/orcid${currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''}`}
                className="w-full"
              >
                <ui.StatefulButton
                  variant="outline"
                  type="submit"
                  disabled={orcidFetcher.state !== 'idle'}
                  busy={orcidFetcher.state !== 'idle'}
                  overlayBusy
                  className="h-10 bg-[#a6ce39] text-white border-[#a6ce39] hover:bg-[#a6ce39]/90 hover:text-white"
                >
                  <span className="flex gap-2 items-center">
                    Auto-fill with <orcid.Badge size={18} white />
                  </span>
                </ui.StatefulButton>
              </orcidFetcher.Form>
            )}
          </div>
        )}
      </div>
      {isLoggedIn && !user?.orcid && (
        <p className="text-sm text-muted-foreground">
          Connect your ORCID account to automatically fill in your information.
        </p>
      )}
    </div>
  );
}
