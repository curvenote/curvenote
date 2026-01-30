import { useEffect, useState } from 'react';
import { useActionData, useFetcher } from 'react-router';
import { ui, orcid } from '@curvenote/scms-core';
import { FormLabel } from './label.js';

type ContactDetailsUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
};

type ContactDetailsProps = {
  user: ContactDetailsUser | null;
};

export function ContactDetails({ user }: ContactDetailsProps) {
  const actionData = useActionData<{
    linkOrcid?: boolean;
    returnTo?: string;
  }>();
  const orcidFetcher = useFetcher();

  const [name, setName] = useState(user?.name ?? '');
  const [affiliation, setAffiliation] = useState(user?.affiliation ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [orcidId, setOrcidId] = useState(user?.orcid ?? '');

  useEffect(() => {
    setName(user?.name ?? '');
    setAffiliation(user?.affiliation ?? '');
    setEmail(user?.email ?? '');
    setOrcidId(user?.orcid ?? '');
  }, [user?.name, user?.affiliation, user?.email, user?.orcid]);

  const currentUrl =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  const isLoggedIn = !!user;

  // Handle ORCID linking: after pending account is created, POST to /auth/orcid (same as forms)
  useEffect(() => {
    if (actionData?.linkOrcid && actionData.returnTo) {
      const authForm = document.createElement('form');
      authForm.method = 'POST';
      authForm.action = `/auth/orcid?returnTo=${encodeURIComponent(actionData.returnTo)}`;
      document.body.appendChild(authForm);
      authForm.submit();
    }
  }, [actionData?.linkOrcid, actionData?.returnTo]);

  return (
    <div className="pb-6 space-y-4 border-b border-border">
      <div className="flex gap-6 items-center">
        <div className="flex flex-col flex-1 gap-4 min-w-0">
          <div className="space-y-2">
            <FormLabel htmlFor="contact-name" required valid={name.trim().length > 0}>
              Your Name
            </FormLabel>
            <ui.Input
              id="contact-name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <FormLabel htmlFor="contact-affiliation" required valid={affiliation.trim().length > 0}>
              Affiliation
            </FormLabel>
            <ui.Input
              id="contact-affiliation"
              name="affiliation"
              type="text"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="University or organization"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <FormLabel htmlFor="contact-email" required valid={email.trim().length > 0}>
              Email
            </FormLabel>
            <ui.Input
              id="contact-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <FormLabel htmlFor="contact-orcid" required={false} valid={orcidId.trim().length > 0}>
              ORCID ID
            </FormLabel>
            <ui.Input
              id="contact-orcid"
              name="orcid"
              type="text"
              value={orcidId}
              onChange={(e) => setOrcidId(e.target.value)}
              placeholder="0000-0000-0000-0000"
              className="w-full"
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
