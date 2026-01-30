import { useEffect } from 'react';
import { useActionData, useFetcher } from 'react-router';
import { primitives, ui, orcid } from '@curvenote/scms-core';
import { User } from 'lucide-react';

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
    <primitives.Card className="p-6" lift>
      <div className="flex gap-3 items-center mb-6">
        <User className="w-6 h-6 text-stone-500 stroke-[1.5px]" />
        <h2 className="text-xl font-semibold">What are your contact details?</h2>
      </div>
      <div className="flex gap-6 items-start">
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <ui.TextField
            id="contact-name"
            name="name"
            label="Your Name"
            placeholder="Full name"
            required
            defaultValue={user?.name}
          />
          <ui.TextField
            id="contact-affiliation"
            name="affiliation"
            label="Affiliation"
            placeholder="University or organization"
            required
            defaultValue={user?.affiliation}
          />
          <ui.TextField
            id="contact-email"
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            required
            defaultValue={user?.email}
          />
          <ui.TextField
            id="contact-orcid"
            name="orcid"
            label="ORCID ID (optional)"
            placeholder="0000-0000-0000-0000"
            defaultValue={user?.orcid}
          />
        </div>
        {!user?.orcid && (
          <div className="flex items-center shrink-0 pt-2">
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
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Connect your ORCID account to automatically fill in your information.
        </p>
      )}
    </primitives.Card>
  );
}
