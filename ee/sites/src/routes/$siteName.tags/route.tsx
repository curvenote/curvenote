import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { data } from 'react-router';
import {
  PageFrame,
  getBrandingFromMetaMatches,
  joinPageTitle,
  scopes,
  ui,
} from '@curvenote/scms-core';
import { withAppSiteContext, sites } from '@curvenote/scms-server';
import { PlusCircle } from 'lucide-react';
import { createTag, updateTag } from './actionHelpers.server.js';
import { CreateTagDialog } from './CreateTagDialog.js';
import { EditTagDialog } from './EditTagDialog.js';
import { TagRow } from './TagRow.js';
import { TagsTable } from './TagsTable.js';
import type { TagCatalogRow } from './types.js';

interface LoaderData {
  siteName: string;
  siteTitle: string;
  tags: TagCatalogRow[];
}

type TagsDialog = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; tag: TagCatalogRow };

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const ctx = await withAppSiteContext(args, [scopes.site.tags.list]);
  const tags = await sites.tags.dbListSiteTagsForCatalog(ctx.site.id);
  return {
    siteName: ctx.site.name,
    siteTitle: ctx.site.title,
    tags,
  };
}

export async function action(args: ActionFunctionArgs) {
  const ctx = await withAppSiteContext(args, [
    scopes.site.tags.create,
    scopes.site.tags.update,
    scopes.site.tags.delete,
  ]);
  const formData = await args.request.formData();
  const intent = formData.get('intent');
  if (intent === 'create-tag') {
    return createTag(ctx, formData);
  }
  if (intent === 'update-tag') {
    return updateTag(ctx, formData);
  }
  return data({ error: `Invalid intent ${intent}` }, { status: 400 });
}

export const meta: MetaFunction<typeof loader> = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('Tags', loaderData?.siteTitle, branding.title) }];
};

export default function TagsPage({ loaderData }: { loaderData: LoaderData }) {
  const { siteName, siteTitle, tags } = loaderData;
  const [dialog, setDialog] = useState<TagsDialog>({ kind: 'none' });

  const breadcrumbs = [
    { label: 'Sites', href: '/app/sites' },
    { label: siteTitle || siteName, href: `/app/sites/${siteName}/inbox` },
    { label: 'Tags', isCurrentPage: true },
  ];

  const openCreate = () => {
    setDialog({ kind: 'create' });
  };
  const closeDialog = () => {
    setDialog({ kind: 'none' });
  };
  const handleCreateOpenChange = (open: boolean) => {
    if (open) {
      setDialog({ kind: 'create' });
      return;
    }
    closeDialog();
  };
  const handleEdit = (tag: TagCatalogRow) => {
    setDialog({ kind: 'edit', tag });
  };
  const handleEditOpenChange = (open: boolean) => {
    if (open) {
      return;
    }
    closeDialog();
  };

  return (
    <PageFrame
      title="Tags"
      subtitle={`Editorial tags for submissions on ${siteTitle}`}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex flex-col gap-6">
        <div>
          <ui.Button variant="default" onClick={openCreate} className="gap-2">
            <PlusCircle className="w-4 h-4" />
            Add Tag
          </ui.Button>
        </div>
        <TagsTable>
          {tags.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="py-4 text-sm text-center text-stone-500 dark:text-stone-400"
              >
                No tags yet. Add a tag to use it on submissions.
              </td>
            </tr>
          ) : (
            tags.map((tag) => <TagRow key={tag.id} tag={tag} onEdit={handleEdit} />)
          )}
        </TagsTable>
      </div>
      <CreateTagDialog
        open={dialog.kind === 'create'}
        onOpenChange={handleCreateOpenChange}
        existingNames={tags.map((tag) => tag.name)}
      />
      <EditTagDialog
        open={dialog.kind === 'edit'}
        onOpenChange={handleEditOpenChange}
        tag={dialog.kind === 'edit' ? dialog.tag : null}
      />
    </PageFrame>
  );
}
