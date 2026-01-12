import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from 'react-router';
import { redirect, data } from 'react-router';
import {
  PageFrame,
  primitives,
  SectionWithHeading,
  ui,
  httpError,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
} from '@curvenote/scms-core';
import type { Check } from '@curvenote/check-definitions';
import { submissionRuleChecks } from '@curvenote/check-definitions';
import { Shapes, ShieldCheck } from 'lucide-react';
import { CheckListItem } from './CheckListItem.js';
import { withAppSiteContext } from '@curvenote/scms-server';
import { useState } from 'react';
import {
  updateKindCheckEnabled,
  updateKindCheckOption,
  updateKindCheckOptional,
  updateKindDefault,
  updateKindDescription,
  updateKindName,
  updateKindTitle,
} from './actionHelpers.server.js';
import { CollectionToggleItem } from '../$siteName.collections.$collectionName/CollectionToggleItem.js';
import { isCheckArray } from '../$siteName.kinds/utils.server.js';
import type { SubmissionKind } from '@prisma/client';

type LoaderData = SubmissionKind & {
  enabledChecks: Check[];
  disabledChecks: Check[];
  siteTitle: string;
  siteName: string;
  defaultKindTitle: string;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.kinds.read]);

  const { kindName } = args.params;
  if (!kindName) throw httpError(400, 'Missing kind name');
  const kind = ctx.site.submissionKinds.find(({ name }) => name === kindName);
  if (!kind) throw httpError(404, 'Kind not found');

  const checks = isCheckArray(kind.checks)
    ? kind.checks.map((check) => {
        return { ...check, ...submissionRuleChecks.find(({ id }) => id === check.id) };
      })
    : [];

  const enabledIds = checks.map(({ id }) => id);
  const defaultKind = ctx.site.submissionKinds.find((c) => c.default && c.name !== kindName);
  const defaultKindTitle = (defaultKind?.content as any)?.title ?? defaultKind?.name;
  return {
    ...kind,
    enabledChecks: checks.map((check): Check => {
      // We could make these all "checks" instead of just "submissionRuleChecks"
      return { ...check, ...submissionRuleChecks.find(({ id }) => id === check.id) };
    }),
    disabledChecks: submissionRuleChecks.filter(({ id }) => !enabledIds.includes(id)),
    defaultKindTitle,
    siteTitle: ctx.site.title,
    siteName: ctx.site.name,
  };
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle(
        (loaderData as any)?.content?.title,
        'Kind Details',
        loaderData?.siteName,
        branding.title,
      ),
    },
  ];
};

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [scopes.site.kinds.update]);

  if (args.request.method.toLowerCase() !== 'post') {
    return data(
      { success: false, error: { message: 'An unexpected error occurred' } },
      { status: 400 },
    );
  }
  const { kindName } = args.params;
  if (!kindName) throw httpError(400, 'Missing kind name');
  const kind = ctx.site.submissionKinds.find(({ name }) => name === kindName);
  if (!kind) throw httpError(404, 'Kind not found');
  const formData = await args.request.formData();
  const intent = formData.get('intent');
  try {
    switch (intent) {
      case 'update-kind-name': {
        const updatedKindOrError = await updateKindName(ctx, kind.id, formData);
        if ('name' in updatedKindOrError && updatedKindOrError.name) {
          return redirect(`/app/sites/${ctx.site.name}/kinds/${updatedKindOrError.name}`);
        }
        return updatedKindOrError;
      }
      case 'update-kind-title':
        return updateKindTitle(ctx, kind.id, formData);
      case 'update-kind-description':
        return updateKindDescription(ctx, kind.id, formData);
      case 'update-kind-default':
        return updateKindDefault(ctx, kind.id, formData);
      case 'update-kind-check-enabled':
        return updateKindCheckEnabled(ctx, kind.id, formData);
      case 'update-kind-check-option':
        return updateKindCheckOption(ctx, kind.id, formData);
      case 'update-kind-check-optional':
        return updateKindCheckOptional(ctx, kind.id, formData);
      default:
        return data(
          { error: { type: 'general', message: `Invalid intent ${intent}` } },
          { status: 400 },
        );
    }
  } catch (error) {
    if (error instanceof Error) {
      return data({ error: { message: error.message } }, { status: 404 });
    }
    return data({ error: { message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export default function KindDetails({ loaderData }: { loaderData: LoaderData }) {
  const { enabledChecks, disabledChecks, siteTitle, siteName, defaultKindTitle, ...kind } =
    loaderData;

  const [checkOrder] = useState([
    ...(enabledChecks as Check[]).map(({ id }) => id),
    ...(disabledChecks as Check[]).map(({ id }) => id),
  ]);

  const title = (kind.content as any)?.title;
  const description = (kind.content as any)?.description;

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle || siteName, href: `/app/sites/${siteName}/inbox` },
    { label: 'Kinds', href: `/app/sites/${siteName}/kinds` },
    { label: title ?? kind.name, isCurrentPage: true },
  ];

  const [nameError, setNameError] = useState<string | null>(null);

  function validateKindName(name: string): string | null {
    if (!name || name.trim().length === 0) return 'Name is required';
    if (name.length > 64) return 'Name must be at most 64 characters';
    if (!/^[a-z0-9\-_]+$/.test(name))
      return 'Only lowercase letters, numbers, hyphens, underscores';
    return null;
  }

  function handleNameChange(newName: string) {
    const error = validateKindName(newName);
    setNameError(error);
  }

  return (
    <PageFrame
      className="max-w-4xl"
      title={
        <>
          Edit Kind: <strong>{title}</strong>
        </>
      }
      subtitle={`Edit details for the ${title} kind, including the checks run on this kind of submissions`}
      breadcrumbs={breadcrumbs}
    >
      {/* Metadata Card */}
      <primitives.Card className="flex relative flex-col gap-4 p-8 mb-8" lift>
        <div className="flex gap-4">
          <div className="flex gap-3 items-center mb-2 grow">
            <Shapes className="w-8 h-8 text-stone-500 stroke-[1.5px]" aria-label="Kind" />
            <ui.InlineEditable
              intent="update-kind-title"
              defaultValue={title}
              className="text-2xl"
              ariaLabel="Edit kind title"
              placeholder="Kind title"
              renderDisplay={(value) => <span className="font-bold">{value}</span>}
            />
          </div>
          <div>
            <ui.InlineEditable
              intent="update-kind-name"
              defaultValue={kind.name}
              ariaLabel="Edit kind name"
              error={nameError || undefined}
              onChange={handleNameChange}
              renderDisplay={(value) => (
                <span className="px-3 py-1 font-mono text-xs rounded-full border border-stone-400 dark:border-stone-200">
                  {value}
                </span>
              )}
              className="px-3 py-1 font-mono text-xs"
            />
          </div>
        </div>
        <div>
          <ui.InlineEditable
            intent="update-kind-description"
            defaultValue={description}
            multiline
            ariaLabel="Edit kind description"
            placeholder="Kind description"
          />
        </div>
      </primitives.Card>
      <primitives.Card className="flex flex-col gap-0 p-0 mb-8" lift>
        <CollectionToggleItem
          intent="update-kind-default"
          title="Make this the default kind?"
          yesText="Yes, this is the default kind"
          noText={
            defaultKindTitle
              ? `No, keep "${defaultKindTitle}" as the default kind`
              : 'No, there is no default kind'
          }
          checked={kind.default}
        />
      </primitives.Card>
      {/* Available Checks Section */}
      <SectionWithHeading
        className="mb-8"
        heading="Available Checks"
        icon={<ShieldCheck className="w-6 h-6 stroke-[1.5px]" />}
      >
        <div className="rounded bg-muted">
          {checkOrder && checkOrder.length > 0 ? (
            <primitives.Card className="p-0" lift>
              <div className="flex flex-col divide-y divide-stone-300 dark:divide-stone-700">
                {checkOrder
                  .map((checkId: string) => {
                    const enabledCheck = (enabledChecks as Check[]).find((c) => c.id === checkId);
                    const disabledCheck = (disabledChecks as Check[]).find((c) => c.id === checkId);
                    if (enabledCheck) {
                      return (
                        <CheckListItem
                          key={checkId}
                          check={enabledCheck}
                          enabled={true}
                          order={checkOrder}
                        />
                      );
                    }
                    if (disabledCheck) {
                      return (
                        <CheckListItem
                          key={checkId}
                          check={disabledCheck}
                          enabled={false}
                          order={checkOrder}
                        />
                      );
                    }
                    return null;
                  })
                  .filter(Boolean)}
              </div>
            </primitives.Card>
          ) : (
            <div className="flex flex-col justify-center items-center py-8 text-center text-muted-foreground">
              <ShieldCheck className="mb-2 w-8 h-8 text-muted-foreground" />
              <span className="text-base">No checks loaded.</span>
            </div>
          )}
        </div>
      </SectionWithHeading>
    </PageFrame>
  );
}
