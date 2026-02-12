import * as React from 'react';
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { data, redirect, useSearchParams } from 'react-router';
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
} from './cookies.server.js';
import { submitForm } from './actionHelpers.server.js';
import { fetchOrcidPerson, searchOrcid, searchOrcidById } from './orcidLookup.server.js';
import { searchRor } from './rorLookup.server.js';
import { isPageComplete, getFieldErrors, isValidOrcid } from './validationUtils.js';
import { FormArea } from './FormArea.js';
import { FormBody } from './FormBody.js';
import { MultiStepForm } from './MultiStepForm.js';
import { FormSyncProvider } from './formSyncContext.js';
import { ReviewStep } from './ReviewStep.js';
import { SuccessStep } from './SuccessStep.js';
import type { FormDefinition, FormSubmission } from './types.js';

/** Example form UI (eventually from DB). Single constant for loader and action validation. */
const EXAMPLE_FORM_UI: FormDefinition = {
  title: '',
  description: '',
  slug: '',
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
    { name: 'title', type: 'string', title: 'Title', required: true },
    {
      name: 'abstract',
      type: 'paragraph',
      title: 'Abstract',
      required: true,
      maxWordCount: 250,
    },
    {
      name: 'keywords',
      type: 'keywords',
      title: 'Keywords',
      required: false,
      placeholder: 'Type and press Enter',
      maxKeywords: 5,
    },
    {
      name: 'authors',
      type: 'author',
      title: 'Authors',
      required: true,
    },
    {
      name: 'license',
      type: 'radio',
      kind: 'vertical',
      title: 'Is the paper being published with a CC BY license?',
      required: true,
      options: [
        { value: 'CC-BY-4.0', label: 'Yes', subLabel: '(CC-BY)' },
        { value: 'Other', label: 'No', subLabel: 'I need a custom license' },
      ],
    },
  ],
  pages: [
    {
      title: 'Choose format',
      slug: 'format',
      children: [{ type: 'field', id: 'format' }],
    },
    {
      title: 'Fill-in abstract',
      shortTitle: 'Abstract',
      slug: 'abstract',
      children: [
        { type: 'field', id: 'title' },
        { type: 'field', id: 'abstract' },
        { type: 'field', id: 'keywords' },
      ],
    },
    {
      title: 'Authors & Affiliations',
      slug: 'authors',
      children: [{ type: 'field', id: 'authors' }],
    },
    {
      title: 'Choose license',
      slug: 'license',
      children: [{ type: 'field', id: 'license' }],
    },
    {
      title: 'Review and Submit',
      shortTitle: 'Review and Submit',
      slug: 'review',
      children: [],
    },
  ],
};

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
  const { title = '', description = '' } =
    (form.data as { title?: string; description?: string }) ?? {};

  const formUI: FormDefinition = {
    ...EXAMPLE_FORM_UI,
    title: title || EXAMPLE_FORM_UI.title,
    description: description || EXAMPLE_FORM_UI.description,
    slug: form.name,
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
  affiliations: [],
  contactName: '',
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

  // Fetch ORCID person by iD (public API lookup for auto-filling author)
  if (intent === 'fetch-orcid') {
    const orcid = (formData.get('orcid') as string)?.trim() ?? '';
    if (!isValidOrcid(orcid)) {
      return data({ error: { message: 'Invalid ORCID format.' } }, { status: 400 });
    }
    const person = await fetchOrcidPerson(orcid);
    if (!person) {
      return data(
        { error: { message: 'Could not find this ORCID or fetch public record.' } },
        { status: 404 },
      );
    }
    return data({
      name: person.name,
      orcid: person.orcid,
      ...(person.email && { email: person.email }),
      affiliations: person.affiliations ?? [],
    });
  }

  // Search ORCID by name/query (for author name typeahead)
  if (intent === 'search-orcid') {
    const q = (formData.get('q') as string)?.trim() ?? '';
    const results = await searchOrcid(q);
    return data({ results });
  }

  // Look up a single ORCID by id (when user types/pastes an ORCID in Add Author box)
  if (intent === 'search-orcid-by-id') {
    const orcid = (formData.get('orcid') as string)?.trim() ?? '';
    if (!isValidOrcid(orcid)) {
      return data({ error: { message: 'Invalid ORCID format.' } }, { status: 400 });
    }
    const results = await searchOrcidById(orcid);
    return data({ results });
  }

  // Search ROR by query (for affiliation typeahead)
  if (intent === 'search-ror') {
    const q = (formData.get('q') as string)?.trim() ?? '';
    const results = await searchRor(q);
    return data({ results });
  }

  // Save one or more fields to the draft Object (create if no objectId, else OCC update)
  if (intent === 'save-fields') {
    const payloadRaw = formData.get('payload') as string | null;
    if (!payloadRaw || typeof payloadRaw !== 'string') throw httpError(400, 'Missing payload');
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    } catch {
      throw httpError(400, 'Invalid payload');
    }
    const keys = Object.keys(payload);
    if (keys.length === 0) throw httpError(400, 'Empty payload');

    let objectId =
      (formData.get('objectId') as string | null) || getDraftObjectIdFromCookie(args.request);

    if (!objectId) {
      objectId = await createDraftObject(payload, ctx.user?.id ?? null);
      return data(
        { objectId },
        { headers: { 'Set-Cookie': setDraftObjectIdCookie(objectId, siteName, formName) } },
      );
    }

    const existingDraft = await getDraftObject(objectId);
    if (!existingDraft) {
      objectId = await createDraftObject(payload, ctx.user?.id ?? null);
      return data(
        { objectId },
        { headers: { 'Set-Cookie': setDraftObjectIdCookie(objectId, siteName, formName) } },
      );
    }

    for (const fieldName of keys) {
      await updateDraftObjectField(objectId, fieldName, payload[fieldName], ctx.user?.id ?? null);
    }
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
    const fieldErrors = getFieldErrors(EXAMPLE_FORM_UI, fields);
    if (fieldErrors.length > 0) {
      return data({ error: { message: fieldErrors[0].message } }, { status: 400 });
    }
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
  const [searchParams] = useSearchParams();
  const expandAuthor = searchParams.get('expandAuthor');
  const expandAffiliation = searchParams.get('expandAffiliation');
  const initialExpandAuthorIndex = expandAuthor != null ? parseInt(expandAuthor, 10) : undefined;
  const initialExpandAffiliationIndex =
    expandAffiliation != null ? parseInt(expandAffiliation, 10) : undefined;

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
  const fieldErrors = getFieldErrors(form, fields);
  const pages: FormSubmission['pages'] = {};
  for (const page of form.pages) {
    let completed: boolean;
    if (isSuccessPage) {
      completed = true;
    } else if (page.slug === 'review') {
      completed = false;
    } else {
      const pageFieldErrors = fieldErrors.filter((e) =>
        page.children.some((c) => c.type === 'field' && c.id === e.schema.name),
      );
      completed = isPageComplete(page, form, fields) && pageFieldErrors.length === 0;
    }
    pages[page.slug] = { completed };
  }
  const submission: FormSubmission = {
    fields,
    pages,
  };

  const basePath = `/forms/${siteName}/${form.slug}/`;

  return (
    <FormSyncProvider>
      <div className="grid h-screen overflow-hidden grid-cols-[1fr_minmax(48ch,72ch)_1fr] gap-8 items-stretch">
        <MultiStepForm
          className="justify-self-end self-stretch mr-5 min-h-0"
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
        <div className="overflow-auto min-h-0">
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
              initialExpandAuthorIndex={
                typeof initialExpandAuthorIndex === 'number' &&
                !Number.isNaN(initialExpandAuthorIndex) &&
                initialExpandAuthorIndex >= 0
                  ? initialExpandAuthorIndex
                  : undefined
              }
              initialExpandAffiliationIndex={
                typeof initialExpandAffiliationIndex === 'number' &&
                !Number.isNaN(initialExpandAffiliationIndex) &&
                initialExpandAffiliationIndex >= 0
                  ? initialExpandAffiliationIndex
                  : undefined
              }
            />
          ) : (
            <FormArea stepNumber="?" stepTitle="Page not found">
              <div className="prose">
                <p>The page you are looking for does not exist.</p>
              </div>
            </FormArea>
          )}
        </div>
      </div>
    </FormSyncProvider>
  );
}
