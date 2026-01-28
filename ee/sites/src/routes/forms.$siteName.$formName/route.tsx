import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { redirect, data, useActionData, Form, useFetcher } from 'react-router';
import {
  primitives,
  ui,
  httpError,
  getBrandingFromMetaMatches,
  joinPageTitle,
  useDeploymentConfig,
  orcid,
  firebase,
  google,
  okta,
} from '@curvenote/scms-core';
import { FileText, User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { withInsecureSiteContext, getPrismaClient } from '@curvenote/scms-server';
import { dbGetForm } from '../$siteName.forms.$formName/db.server.js';
import { dbListCollections } from '../$siteName.collections/db.server.js';
import { submitForm } from './actionHelpers.server.js';
import { uuidv7 } from 'uuidv7';
import { formatDate } from '@curvenote/common';

type AgreementURL = { label: string; url: string };

type LoaderData = Awaited<ReturnType<typeof dbGetForm>> & {
  siteName: string;
  siteTitle: string;
  formCollections: Awaited<ReturnType<typeof dbListCollections>>;
  user?: {
    name?: string;
    email?: string;
    orcid?: string;
    affiliation?: string;
    pending?: boolean;
    hasAcceptedTerms?: boolean;
  };
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withInsecureSiteContext(args);
  const user = ctx.user;

  const { formName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');

  const form = await dbGetForm(formName, ctx.site.id);
  const collections = await dbListCollections(ctx.site.id);

  // Filter collections to only those associated with the form
  const formCollectionIds = new Set(form.collections.map((cif: any) => cif.collection.id));
  const formCollections = collections.filter((c) => formCollectionIds.has(c.id));

  // Get user info if logged in
  const orcidUser = user
    ? {
        name: user.display_name ?? undefined,
        email: user.email ?? undefined,
        orcid:
          user.linkedAccounts?.find((la) => la.provider === 'orcid')?.idAtProvider ?? undefined,
        pending: user.pending ?? false,
      }
    : undefined;
  return {
    ...form,
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    formCollections,
    user: orcidUser,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withInsecureSiteContext(args);

  const { formName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');

  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  // Handle ORCID linking intent - create pending linked account and redirect to OAuth
  if (intent === 'link-orcid' && ctx.user) {
    console.log('[FORM] ORCID linking intent detected', {
      userId: ctx.user.id,
      formName,
      siteName: ctx.site.name,
    });

    const prisma = await getPrismaClient();
    const timestamp = formatDate();

    // Create pending linked account (same logic as settings page)
    const linkedAccount = await prisma.userLinkedAccount.upsert({
      where: {
        uniqueProviderUserId: {
          user_id: ctx.user.id,
          provider: 'orcid',
        },
      },
      update: {
        date_modified: timestamp,
        date_linked: null,
        pending: true,
      },
      create: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        date_linked: null,
        user_id: ctx.user.id,
        provider: 'orcid',
        pending: true,
      },
    });

    console.log('[FORM] Created/updated pending linked account', {
      linkedAccountId: linkedAccount.id,
      userId: ctx.user.id,
      pending: linkedAccount.pending,
    });

    // NOTE: We cannot redirect to `/auth/orcid` here because it must be a POST.
    // The client initiates the OAuth POST (see LinkAccount-style flow in the component).
    return data({ ok: true });
  }

  const form = await dbGetForm(formName, ctx.site.id);

  try {
    const result = await submitForm(ctx, ctx.user ?? null, form, formData, args);
    if ('workId' in result && result.workId) {
      return redirect(`/forms/${ctx.site.name}/${formName}/success?workId=${result.workId}`);
    }
    return result;
  } catch (error) {
    if (error instanceof Error) {
      return data({ error: { message: error.message } }, { status: 400 });
    }
    return data({ error: { message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle(
        (loaderData?.data as any)?.title,
        'Submit',
        loaderData?.siteName,
        branding.title,
      ),
    },
  ];
};

export default function SubmitForm({ loaderData }: { loaderData: LoaderData }) {
  const { formCollections, user, ...form } = loaderData;
  const actionData = useActionData<{ error?: { message?: string } }>();
  const config = useDeploymentConfig();
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(user?.hasAcceptedTerms ?? false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const orcidInputRef = useRef<HTMLInputElement>(null);

  const title = (form.data as any)?.title ?? form.name;
  const description = (form.data as any)?.description;

  const hasMultipleCollections = formCollections.length > 1;
  const isLoggedIn = !!user;
  const isPending = user?.pending ?? false;
  // Show terms checkbox if user is not logged in OR if user is pending
  const showTermsCheckbox = !isLoggedIn || isPending;
  const agreementStep = config.signupConfig?.signup?.steps?.find(
    (step) => step.type === 'agreement',
  );
  const agreementUrls: AgreementURL[] = agreementStep?.agreementUrls ?? [];
  const authProviders = config.authProviders?.filter((p) => p.allowLogin) ?? [];
  const hasFirebase = authProviders.some((p) => p.provider === 'firebase');
  const hasGoogle = authProviders.some((p) => p.provider === 'google');
  const hasOkta = authProviders.some((p) => p.provider === 'okta');

  // Get current form URL for returnTo
  const currentUrl =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  const orcidFetcher = useFetcher();

  useEffect(() => {
    if (orcidFetcher.state !== 'idle') {
      setSubmitting(true);
    } else {
      setSubmitting(false);
    }
  }, [orcidFetcher.state]);

  return (
    <div className="px-4 mx-auto mt-8 max-w-3xl">
      <primitives.Card className="p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
          {description && <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>}
        </div>

        {actionData?.error && (
          <div className="p-4 mb-6 text-sm text-red-600 bg-red-50 rounded border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {actionData.error.message || 'An error occurred while submitting'}
          </div>
        )}

        <Form
          method="post"
          className="flex flex-col gap-8"
          onSubmit={(e) => {
            if (showTermsCheckbox && !agreedToTerms) {
              e.preventDefault();
              return;
            }
          }}
        >
          {/* Your Details Section */}
          <primitives.Card className="p-6" lift>
            <div className="flex gap-3 items-center mb-6">
              <User className="w-6 h-6 text-stone-500 stroke-[1.5px]" />
              <h2 className="text-xl font-semibold">Your Details</h2>
            </div>
            <div className="flex flex-col gap-4">
              <ui.TextField
                id="submitter-name"
                name="name"
                label="Name"
                placeholder="Your full name"
                required
                defaultValue={user?.name}
                ref={nameInputRef}
              />
              <ui.TextField
                id="submitter-email"
                name="email"
                type="email"
                label="Email"
                placeholder="your.email@example.com"
                required
                defaultValue={user?.email}
              />
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <ui.TextField
                      id="submitter-orcid"
                      name="orcid"
                      label="ORCID"
                      placeholder="0000-0000-0000-0000"
                      defaultValue={user?.orcid}
                      ref={orcidInputRef}
                    />
                  </div>
                  {!user?.orcid && (
                    <div className="pb-2">
                      {isLoggedIn ? (
                        <orcidFetcher.Form
                          method="post"
                          action={`/auth/orcid${
                            currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''
                          }`}
                          onSubmit={async (e) => {
                            await fetch(window.location.pathname + window.location.search, {
                              method: 'POST',
                              body: new FormData(e.currentTarget),
                            });
                          }}
                          className="w-full"
                        >
                          <input type="hidden" name="intent" value="link-orcid" />
                          <ui.StatefulButton
                            variant="outline"
                            type="submit"
                            disabled={submitting}
                            busy={orcidFetcher.state !== 'idle'}
                            overlayBusy
                            className="h-10"
                          >
                            <orcid.Badge size={18} />
                          </ui.StatefulButton>
                        </orcidFetcher.Form>
                      ) : (
                        // For non-logged-in users: create account (direct OAuth redirect)
                        <orcidFetcher.Form
                          method="post"
                          action={`/auth/orcid${currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''}`}
                          className="w-full"
                        >
                          <ui.StatefulButton
                            variant="outline"
                            type="submit"
                            disabled={submitting}
                            busy={orcidFetcher.state !== 'idle'}
                            overlayBusy
                            className="h-10"
                          >
                            <orcid.Badge size={18} />
                          </ui.StatefulButton>
                        </orcidFetcher.Form>
                      )}
                    </div>
                  )}
                </div>
                {!isLoggedIn && (
                  <div className="flex gap-2 items-center text-sm text-gray-600 dark:text-gray-400">
                    <span>Already have an account?</span>
                    {hasFirebase && (
                      <firebase.FirebaseGoogleLoginUI
                        disabled={submitting}
                        setSubmitting={setSubmitting}
                        className="h-8"
                      />
                    )}
                    {hasGoogle && !hasFirebase && (
                      <google.LoginUI
                        disabled={submitting}
                        setSubmitting={setSubmitting}
                        className="h-8"
                      />
                    )}
                    {hasOkta && (
                      <okta.LoginUI
                        disabled={submitting}
                        setSubmitting={setSubmitting}
                        className="h-8"
                      />
                    )}
                  </div>
                )}
                {isLoggedIn && !user?.orcid && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connect your ORCID account to automatically fill in your information.
                  </p>
                )}
              </div>
              <ui.TextField
                id="submitter-affiliation"
                name="affiliation"
                label="Affiliation"
                placeholder="Your institution or organization"
                defaultValue={user?.affiliation}
              />
              <div className="flex gap-2 items-center">
                <ui.Checkbox
                  id="is-corresponding-author"
                  name="isCorrespondingAuthor"
                  value="true"
                  defaultChecked={true}
                />
                <label
                  htmlFor="is-corresponding-author"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  You are the corresponding author
                </label>
              </div>
            </div>
          </primitives.Card>

          {/* Collection Selection (only if multiple) */}
          {hasMultipleCollections ? (
            <primitives.Card className="p-6" lift>
              <div className="flex gap-3 items-center mb-6">
                <FileText className="w-6 h-6 text-stone-500 stroke-[1.5px]" />
                <h2 className="text-xl font-semibold">Collection</h2>
              </div>
              <ui.Select name="collectionId" required>
                <ui.SelectTrigger>
                  <ui.SelectValue placeholder="Select a collection" />
                </ui.SelectTrigger>
                <ui.SelectContent>
                  {formCollections.map((collection) => (
                    <ui.SelectItem key={collection.id} value={collection.id}>
                      {(collection.content as any)?.title ?? collection.name}
                    </ui.SelectItem>
                  ))}
                </ui.SelectContent>
              </ui.Select>
            </primitives.Card>
          ) : (
            // Hidden input for single collection
            <input type="hidden" name="collectionId" value={formCollections[0]?.id} />
          )}

          {/* Work Details Section */}
          <primitives.Card className="p-6" lift>
            <div className="flex gap-3 items-center mb-6">
              <FileText className="w-6 h-6 text-stone-500 stroke-[1.5px]" />
              <h2 className="text-xl font-semibold">Work Details</h2>
            </div>
            <div className="flex flex-col gap-4">
              <ui.TextField
                id="work-title"
                name="workTitle"
                label="Title"
                placeholder="Title of your work"
                required
              />
              <primitives.TextArea
                id="work-description"
                name="workDescription"
                label="Description"
                placeholder="Brief description of your work"
                rows={4}
              />
            </div>
          </primitives.Card>

          {/* Terms Acceptance (for non-logged-in users or pending users) */}
          {showTermsCheckbox && agreementUrls.length > 0 && (
            <primitives.Card className="p-6" lift>
              {agreedToTerms && <input type="hidden" name="agreedToTerms" value="true" />}
              <div className="flex gap-3 items-start">
                <ui.Checkbox
                  id="terms-checkbox"
                  checked={agreedToTerms}
                  onCheckedChange={(value) => setAgreedToTerms(!!value)}
                  required
                />
                <label
                  htmlFor="terms-checkbox"
                  className="text-sm cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I accept the{' '}
                  {agreementUrls.map((url, index) => (
                    <span key={index}>
                      {index > 0 && index === agreementUrls.length - 1 && ' and '}
                      {index > 0 && index < agreementUrls.length - 1 && ', '}
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
                      >
                        {url.label}
                      </a>
                    </span>
                  ))}
                </label>
              </div>
            </primitives.Card>
          )}

          <div className="flex gap-4 justify-end">
            <ui.Button
              type="submit"
              variant="default"
              className="px-8"
              disabled={showTermsCheckbox && !agreedToTerms}
            >
              {isLoggedIn && !isPending ? 'Submit' : 'Create Account and Submit'}
            </ui.Button>
          </div>
        </Form>
      </primitives.Card>
    </div>
  );
}
