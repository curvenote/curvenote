import * as React from 'react';
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { data, redirect } from 'react-router';
import { httpError, getBrandingFromMetaMatches, joinPageTitle, scopes } from '@curvenote/scms-core';
import {
  withAppSiteContext,
  withInsecureSiteContext,
  dbUpsertPendingLinkedAccount,
} from '@curvenote/scms-server';
import { dbGetForm } from '../$siteName.forms.$formName/db.server.js';
import {
  createDraftObject,
  getDraftObject,
  getWorkIdIfOwnedByUser,
  updateDraftObjectField,
} from './db.server.js';
import {
  getDraftObjectIdFromCookie,
  setDraftObjectIdCookie,
  clearDraftCookie,
} from './draft.server.js';
import { submitForm } from './actionHelpers.server.js';
import { isPageComplete } from './validationUtils.js';
import { FormArea, FormBody, MultiStepForm } from './form.js';
import { FormSyncProvider } from './formSyncContext.js';
import { ReviewStep } from './ReviewStep.js';
import { SuccessStep } from './SuccessStep.js';
import type { FormDefinition, FormSubmission } from './types.js';

type FormCollectionOption = {
  id: string;
  name: string;
  title: string;
};

type LoaderData = {
  siteName: string;
  siteTitle: string;
  formName: string;
  pageName?: string;
  user: {
    name?: string;
    email?: string;
    orcid?: string;
    affiliation?: string;
    pending?: boolean;
  } | null;
  form: FormDefinition;
  /** Collections associated with the form (for collection picker on review). */
  formCollections: FormCollectionOption[];
  /** Draft object id from cookie (if any). */
  draftObjectId: string | null;
  /** Draft field data from DB for hydration (if draft exists). */
  draftData: Record<string, unknown> | null;
  /** Set when on success page: workId from ?workId= search param. */
  workId: string | null;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  let ctx = await withInsecureSiteContext(args);
  if (ctx.site.restricted) {
    ctx = await withAppSiteContext(args, [scopes.site.submissions.create]);
  }
  const { formName, siteName, pageName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');
  if (!siteName) throw httpError(400, 'Missing site name');
  const form = await dbGetForm(formName, ctx.site.id);

  const formCollections: FormCollectionOption[] =
    form.collections?.map((c: { collection: { id: string; name: string; content?: unknown } }) => ({
      id: c.collection.id,
      name: c.collection.name,
      title: (c.collection.content as { title?: string })?.title ?? c.collection.name,
    })) ?? [];

  // Get user info if logged in (or pending after ORCID sign-in)
  const user = ctx.user
    ? {
        name: ctx.user.display_name ?? undefined,
        email: ctx.user.email ?? undefined,
        orcid:
          ctx.user.linkedAccounts.find((la) => la.provider === 'orcid')?.idAtProvider ?? undefined,
        affiliation: (ctx.user as { affiliation?: string }).affiliation ?? undefined,
        pending: (ctx.user as { pending?: boolean }).pending ?? false,
      }
    : null;
  // return {
  //   ...form,
  //   siteName: ctx.site.name,
  //   siteTitle: ctx.site.title,
  //   formCollections,
  //   user,
  // };

  const { title = '', description = '' } =
    (form.data as { title?: string; description?: string }) ?? {};

  const formUI: FormDefinition = {
    title: title,
    description: description,
    slug: form.name,
    banner: {
      url: 'https://fastly.picsum.photos/id/640/400/200.jpg?hmac=G1mHrvmA_S_hACaus12cj8muJI-q9cI8C3_8e2GF2rM',
      optimizedUrl:
        'https://fastly.picsum.photos/id/640/400/200.jpg?hmac=G1mHrvmA_S_hACaus12cj8muJI-q9cI8C3_8e2GF2rM',
    },
    fields: [
      {
        name: 'format',
        type: 'radio',
        title: 'How would you like to present your science?',
        kind: 'vertical',
        required: true,
        options: [
          {
            value: 'poster',
            label: 'Poster',
            subLabel: 'Design and bring a physical poster and stand next to it at the event.',
          },
          {
            value: 'presentation',
            label: 'Oral Presentation',
            subLabel: 'Give a presentation at an assigned time to a live audience.',
          },
        ],
      },
      {
        name: 'title',
        type: 'string',
        title: 'Title',
        required: true,
      },
      {
        name: 'abstract',
        type: 'paragraph',
        title: 'Abstract',
        required: true,
        wordCount: {
          max: 250,
        },
      },
      {
        name: 'keywords',
        type: 'keywords',
        title: 'Keywords',
        required: false,
        placeholder: 'Type a keyword and press Enter to add',
      },
      {
        name: 'authors',
        type: 'author',
        title: 'List the authors of this submission',
        required: true,
      },
      {
        name: 'license',
        type: 'radio',
        kind: 'vertical',
        title: 'Is the paper being published with a CC BY license?',
        required: true,
        options: [
          {
            value: 'CC-BY-4.0',
            label: 'Yes',
            subLabel: '(CC-BY)',
          },
          {
            value: 'Other',
            label: 'No',
            subLabel: 'I need a custom license',
          },
        ],
      },
    ],
    pages: [
      {
        title: 'Choose format',
        slug: 'format',
        children: [
          {
            type: 'field',
            id: 'format',
          },
        ],
      },
      {
        title: 'Fill-in abstract',
        shortTitle: 'Abstract',
        slug: 'abstract',
        children: [
          { type: 'field', id: 'title' },
          {
            type: 'field',
            id: 'abstract',
          },
          { type: 'field', id: 'keywords' },
        ],
      },
      {
        title: 'List authors',
        slug: 'authors',
        children: [
          {
            type: 'field',
            id: 'authors',
          },
        ],
      },
      {
        title: 'Choose license',
        slug: 'license',
        children: [
          {
            type: 'field',
            id: 'license',
          },
        ],
      },
      {
        title: 'Review and Submit',
        shortTitle: 'Review and Submit',
        slug: 'review',
        children: [],
      },
    ],
  };

  const draftObjectId = getDraftObjectIdFromCookie(args.request);
  let draftData: Record<string, unknown> | null = null;
  if (draftObjectId) {
    const draft = await getDraftObject(draftObjectId);
    if (draft?.data && typeof draft.data === 'object' && !Array.isArray(draft.data)) {
      draftData = draft.data as Record<string, unknown>;
    }
  }

  const url = new URL(args.request.url);
  let workId: string | null = url.searchParams.get('workId');
  const pageNameFromParams = args.params.pageName;
  if (pageNameFromParams === 'success') {
    workId = workId ? await getWorkIdIfOwnedByUser(workId, ctx.user?.id ?? null) : null;
  }

  return {
    siteName,
    siteTitle: ctx.site.title,
    formName,
    pageName: pageName || formUI.pages[0]?.slug || undefined,
    user,
    form: formUI,
    formCollections,
    draftObjectId,
    draftData,
    workId,
  };
}

function parseFieldValue(raw: string): unknown {
  if (raw === '') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/** Same fallbacks as the page; submit uses merged { ...FALLBACK_FIELDS, ...draft } so we submit what we display. */
const FALLBACK_FIELDS: FormSubmission['fields'] = {
  title:
    'Linking soil structure and function: pore network analysis to understand soil hydraulic properties',
  abstract:
    "Understanding the relationship between soil structure and hydraulic properties is essential for optimizing agricultural water management practices. This study introduces an innovative approach that integrates X-ray computed tomography (CT) imaging with pore network analysis to effectively characterize soil structure and predict hydraulic conductivity.\n\nTo conduct this research, intact soil cores were collected from various agricultural fields and scanned using X-ray CT technology at a high resolution of 30 µm. This advanced imaging technique allows for a detailed examination of the soil's internal structure, revealing the intricate arrangement of pores and particles. Following the scanning process, sophisticated image processing techniques, including segmentation and skeletonization, were employed to extract three-dimensional",
  keywords: [],
  format: '',
  license: '',
  authors: [],
  contactName: '',
  contactAffiliation: '',
  contactEmail: '',
  contactOrcidId: '',
};

export async function action(args: ActionFunctionArgs) {
  let ctx = await withInsecureSiteContext(args);
  if (ctx.site.restricted) {
    ctx = await withAppSiteContext(args, [scopes.site.submissions.create]);
  }
  const { formName, siteName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');
  if (!siteName) throw httpError(400, 'Missing site name');

  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  // Handle ORCID linking intent - create pending linked account and redirect to OAuth (same as forms)
  if (intent === 'link-orcid' && ctx.user) {
    await dbUpsertPendingLinkedAccount(ctx.user.id, 'orcid');
    const currentUrl = new URL(args.request.url).pathname + new URL(args.request.url).search;
    return data({ linkOrcid: true, returnTo: currentUrl });
  }

  // Save a single field to the draft Object (create if no objectId, else OCC update)
  if (intent === 'save-field') {
    const fieldName = formData.get('fieldName') as string | null;
    const valueRaw = formData.get('value') as string | null;
    if (!fieldName) throw httpError(400, 'Missing field name');
    const value = valueRaw !== null ? parseFieldValue(valueRaw) : undefined;

    let objectId =
      (formData.get('objectId') as string | null) || getDraftObjectIdFromCookie(args.request);

    if (!objectId) {
      objectId = await createDraftObject({ [fieldName]: value }, ctx.user?.id ?? null);
      return data(
        { objectId },
        { headers: { 'Set-Cookie': setDraftObjectIdCookie(objectId, siteName, formName) } },
      );
    }

    // Cookie may point to a draft that no longer exists; create a new one and reset cookie
    const existingDraft = await getDraftObject(objectId);
    if (!existingDraft) {
      objectId = await createDraftObject({ [fieldName]: value }, ctx.user?.id ?? null);
      return data(
        { objectId },
        { headers: { 'Set-Cookie': setDraftObjectIdCookie(objectId, siteName, formName) } },
      );
    }

    await updateDraftObjectField(objectId, fieldName, value, ctx.user?.id ?? null);
    return data({ objectId });
  }

  // Submit (logged-in only): load draft, build payload, create work and submission
  if (intent === 'submit') {
    if (!ctx.user) {
      return data({ error: { message: 'Please sign in before submitting.' } }, { status: 400 });
    }
    const objectId =
      (formData.get('objectId') as string | null) || getDraftObjectIdFromCookie(args.request);
    if (!objectId) {
      return data(
        { error: { message: 'No draft found. Please complete the form and try again.' } },
        { status: 400 },
      );
    }
    const draft = await getDraftObject(objectId);
    if (!draft?.data || typeof draft.data !== 'object' || Array.isArray(draft.data)) {
      return data({ error: { message: 'Invalid draft. Please try again.' } }, { status: 400 });
    }
    // Merge with fallbacks so we submit exactly what the review page displays (UI = fallback + draft)
    const fields = {
      ...FALLBACK_FIELDS,
      ...(draft.data as Record<string, unknown>),
    } as Record<string, unknown>;
    const form = await dbGetForm(formName!, ctx.site.id);
    const collectionId =
      (fields.collectionId as string)?.trim() ||
      (form.collections?.length === 1 ? form.collections[0].collection.id : undefined) ||
      form.collections?.[0]?.collection?.id;
    if (!collectionId) {
      return data({ error: { message: 'Collection is required.' } }, { status: 400 });
    }
    const authorsRaw = (fields.authors as { name?: string }[] | undefined) ?? [];
    const authors = authorsRaw.map((a) => (a?.name ?? '').trim()).filter(Boolean);

    // Contact details: same precedence as UI (user then merged fields) so we submit what we display
    const userOrcid = ctx.user.linkedAccounts?.find((la) => la.provider === 'orcid')?.idAtProvider;
    const name = String(fields.contactName || ctx.user.display_name || '').trim();
    const email = String(fields.contactEmail || ctx.user.email || '').trim();
    const contactOrcid = String(fields.contactOrcidId || userOrcid || '').trim();
    const contactAffiliation = String(fields.contactAffiliation || '').trim();
    const workTitle = String(fields.title ?? '').trim();
    if (!name) {
      return data({ error: { message: 'Your name is required.' } }, { status: 400 });
    }
    if (!email) {
      return data({ error: { message: 'Email is required.' } }, { status: 400 });
    }
    if (!workTitle) {
      return data({ error: { message: 'Title is required.' } }, { status: 400 });
    }

    const submitData = new FormData();
    submitData.set('intent', 'submit');
    submitData.set('objectId', objectId);
    submitData.set('name', name);
    submitData.set('email', email);
    if (contactOrcid) submitData.set('orcid', contactOrcid);
    if (contactAffiliation) submitData.set('affiliation', contactAffiliation);
    submitData.set('collectionId', collectionId);
    submitData.set('workTitle', workTitle);
    if (fields.abstract) submitData.set('workDescription', String(fields.abstract));
    submitData.set('authors', JSON.stringify(authors));
    submitData.set('formMetadata', JSON.stringify(fields));
    const isPending = (ctx.user as { pending?: boolean }).pending ?? false;
    if (isPending && formData.get('agreedToTerms') === 'true') {
      submitData.set('agreedToTerms', 'true');
    }

    const result = await submitForm(ctx, ctx.user!, form, submitData, args);
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      return data(result as { error: { message: string } }, { status: 400 });
    }
    const ok = result as { workId?: string; submissionId?: string };
    if (ok?.workId) {
      throw redirect(
        `/forms/${siteName}/${formName}/success?workId=${encodeURIComponent(ok.workId)}`,
        { headers: { 'Set-Cookie': clearDraftCookie(siteName, formName!) } },
      );
    }
    return result;
  }
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  const pageTitle =
    loaderData?.pageName === 'success' && loaderData?.workId
      ? 'Submission Successful'
      : (loaderData?.form.title ?? '');
  return [
    {
      title: joinPageTitle(pageTitle, loaderData?.siteName, branding.title),
    },
  ];
};

export default function SubmitForm({ loaderData }: { loaderData: LoaderData }) {
  const { form, siteName, pageName, draftObjectId: loaderDraftId, draftData } = loaderData;
  const [draftObjectId, setDraftObjectId] = React.useState<string | null>(loaderDraftId ?? null);

  // Sync draft id from loader (e.g. after refresh with cookie)
  React.useEffect(() => {
    if (loaderDraftId) setDraftObjectId(loaderDraftId);
  }, [loaderDraftId]);

  const currentPageSlug = pageName;
  const isSuccessPage = pageName === 'success' && loaderData.workId != null;
  // When we're on the success URL (valid or not), show "Review and Submit" as active in the sidebar
  const sidebarCurrentPage = pageName === 'success' ? 'review' : currentPageSlug;
  const currentPage = form.pages.find((page) => page.slug === currentPageSlug);
  const currentPageIndex = form.pages.findIndex((page) => page.slug === currentPageSlug);
  const reviewStepIndex = form.pages.findIndex((page) => page.slug === 'review');
  const stepNumber = isSuccessPage ? reviewStepIndex + 1 : currentPageIndex + 1;

  const fields = { ...FALLBACK_FIELDS, ...draftData } as FormSubmission['fields'];
  const pages: FormSubmission['pages'] = {};
  for (const page of form.pages) {
    // On success page, show all steps checked (draft is gone so we can't recompute from data)
    const completed = isSuccessPage
      ? true
      : page.slug === 'review'
        ? false
        : isPageComplete(page, form, fields);
    pages[page.slug] = { completed };
  }
  const submission: FormSubmission = {
    fields,
    pages,
  };

  const basePath = `/forms/${siteName}/${form.slug}/`;

  return (
    <FormSyncProvider>
      <div className="grid min-h-screen grid-cols-[1fr_minmax(48ch,72ch)_1fr] gap-8 items-stretch">
        <MultiStepForm
          className="justify-self-end self-stretch mr-5"
          formName={form.title}
          title={String(submission.fields.title || 'New Submission')}
          description={form.description}
          formPages={form.pages}
          currentPage={sidebarCurrentPage}
          submission={submission}
          user={loaderData.user}
          basePath={basePath}
          stepsDisabled={isSuccessPage}
        />
        {isSuccessPage ? (
          <SuccessStep
            stepNumber={stepNumber}
            workId={loaderData.workId ?? null}
            isLoggedIn={!!loaderData.user}
          />
        ) : currentPage?.slug === 'review' ? (
          <ReviewStep
            stepNumber={stepNumber}
            form={form}
            submission={submission}
            user={loaderData.user}
            basePath={basePath}
            draftObjectId={draftObjectId}
            onDraftCreated={setDraftObjectId}
            siteTitle={loaderData.siteTitle}
            formCollections={loaderData.formCollections}
          />
        ) : currentPage ? (
          <FormBody
            stepNumber={stepNumber}
            stepTitle={currentPage.title}
            form={form}
            formChildren={currentPage.children}
            formFields={form.fields}
            formPages={form.pages}
            currentPageSlug={currentPageSlug!}
            basePath={basePath}
            submission={submission}
            user={loaderData.user}
            draftObjectId={draftObjectId}
            onDraftCreated={setDraftObjectId}
          />
        ) : (
          <FormArea stepNumber="?" stepTitle="Page not found">
            <div className="prose">
              <p>The page you are looking for does not exist.</p>
            </div>
          </FormArea>
        )}
      </div>
    </FormSyncProvider>
  );
}
