import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { redirect, data, useActionData, Form } from 'react-router';
import {
  primitives,
  ui,
  httpError,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
} from '@curvenote/scms-core';
import { FileText, User } from 'lucide-react';
import {
  withAppSiteContext,
  withInsecureSiteContext,
  dbUpsertPendingLinkedAccount,
} from '@curvenote/scms-server';
import { dbGetForm } from '../$siteName.forms.$formName/db.server.js';
import { dbListCollections } from '../$siteName.collections/db.server.js';
import { submitForm } from './actionHelpers.server.js';
import { FormArea, FormBody, MultiStepForm } from './form.js';
import { ContactDetails } from './ContactDetails.js';
import type { FormDefinition, FormSubmission } from './types.js';
import { formatError } from 'zod';

type LoaderData = {
  siteName: string;
  formName: string;
  pageName?: string;
  // siteTitle: string;
  // formCollections: Awaited<ReturnType<typeof dbListCollections>>;
  user: {
    name?: string;
    email?: string;
    orcid?: string;
    affiliation?: string;
  } | null;
  form: FormDefinition;
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

  // const collections = await dbListCollections(ctx.site.id);
  // // Filter collections to only those associated with the form
  // const formCollectionIds = new Set(form.collections.map((cif: any) => cif.collection.id));
  // const formCollections = collections.filter((c) => formCollectionIds.has(c.id));
  // Get user info if logged in
  const user = ctx.user
    ? {
        name: ctx.user.display_name ?? undefined,
        email: ctx.user.email ?? undefined,
        orcid:
          ctx.user.linkedAccounts.find((la) => la.provider === 'orcid')?.idAtProvider ?? undefined,
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
        type: 'string',
        title: 'Keywords',
        required: false,
        placeholder: 'Type and press enter...',
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
            value: '',
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
    ],
  };

  return {
    siteName,
    formName,
    pageName: pageName || formUI.pages[0]?.slug || undefined,
    user,
    form: formUI,
  };
}

export async function action(args: ActionFunctionArgs) {
  let ctx = await withInsecureSiteContext(args);
  if (ctx.site.restricted) {
    ctx = await withAppSiteContext(args, [scopes.site.submissions.create]);
  }
  const { formName } = args.params;
  if (!formName) throw httpError(400, 'Missing form name');

  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  // Handle ORCID linking intent - create pending linked account and redirect to OAuth (same as forms)
  if (intent === 'link-orcid' && ctx.user) {
    await dbUpsertPendingLinkedAccount(ctx.user.id, 'orcid');
    const currentUrl = new URL(args.request.url).pathname + new URL(args.request.url).search;
    return data({ linkOrcid: true, returnTo: currentUrl });
  }

  // TODO: submit form handling when needed
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle(loaderData?.form.title, loaderData?.siteName, branding.title),
    },
  ];
};

export default function SubmitForm({ loaderData }: { loaderData: LoaderData }) {
  const { form, siteName, pageName } = loaderData;
  // const actionData = useActionData<{ error?: { message?: string } }>();

  // const title = (form.data as any)?.title ?? form.name;
  // const description = (form.data as any)?.description;

  // const hasMultipleCollections = formCollections.length > 1;

  const currentPageSlug = pageName;
  const currentPage = form.pages.find((page) => page.slug === currentPageSlug);
  const currentPageIndex = form.pages.findIndex((page) => page.slug === currentPageSlug);
  const stepNumber = currentPageIndex + 1;

  // Data continues to live in the frontend for now
  const submission: FormSubmission = {
    fields: {
      title:
        'Linking soil structure and function: pore network analysis to understand soil hydraulic properties',
      abstract:
        "Understanding the relationship between soil structure and hydraulic properties is essential for optimizing agricultural water management practices. This study introduces an innovative approach that integrates X-ray computed tomography (CT) imaging with pore network analysis to effectively characterize soil structure and predict hydraulic conductivity.\n\nTo conduct this research, intact soil cores were collected from various agricultural fields and scanned using X-ray CT technology at a high resolution of 30 µm. This advanced imaging technique allows for a detailed examination of the soil's internal structure, revealing the intricate arrangement of pores and particles. Following the scanning process, sophisticated image processing techniques, including segmentation and skeletonization, were employed to extract three-dimensional",
      keywords: '',
    },
    pages: {
      license: {
        completed: true,
      },
    },
  };

  return (
    <div className="grid grid-cols-[1fr_minmax(48ch,72ch)_1fr] gap-8 items-start">
      <MultiStepForm
        className="justify-self-end mr-5"
        formName={form.title}
        title={submission.fields.title || 'New Submission'}
        description={form.description}
        formPages={form.pages}
        currentPage={currentPageSlug}
        submission={submission}
        user={loaderData.user}
        basePath={`/formsui/${siteName}/${form.slug}/`}
      />
      {currentPage && (
        <div className="flex flex-col gap-8">
          {currentPage.slug === 'authors' && <ContactDetails user={loaderData.user} />}
          <FormBody
            stepNumber={stepNumber}
            stepTitle={currentPage.title}
            formChildren={currentPage.children}
            formFields={form.fields}
            submission={submission}
          />
        </div>
      )}
      {!currentPage && (
        <FormArea stepNumber="?" stepTitle="Page not found">
          <div className="prose">
            <p>The page you are looking for does not exist.</p>
          </div>
        </FormArea>
      )}
    </div>
  );
}
