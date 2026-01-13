import { useFetcher } from 'react-router';
import { SquarePen, SquareCheckBig, Trash2, CirclePlus } from 'lucide-react';
import classNames from 'classnames';
import { formatDistanceToNow } from 'date-fns';
import type { SlugsDTO } from './types.server.js';
import type { SiteDTO } from '@curvenote/common';
import { primitives } from '@curvenote/scms-core';

export function getSlugSuggestion(site: SiteDTO, doi?: string) {
  const secondPartOfDoi = doi?.split('/')[1];
  return secondPartOfDoi ?? `${site.name}-`;
}

export function Slugs({
  siteId,
  submissionId,
  slugs,
  fallback,
  canEdit,
  suggestion,
  baseUrl,
}: {
  siteId: string;
  submissionId: string;
  slugs: SlugsDTO;
  fallback: string;
  canEdit: boolean;
  baseUrl: string;
  suggestion?: string;
}) {
  const fetcher = useFetcher<{ error?: string; slugs?: SlugsDTO }>();
  const makeSuggestion = suggestion ? !slugs.find((s) => s.slug === suggestion) : false;

  const handleAddFirstSlug = (e: React.MouseEvent<HTMLDivElement>) => {
    // only hand directly adding if we have no slugs
    if (slugs.length > 0) return;
    handleAdd(e);
  };

  const handleAdd = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canEdit) return;

    const newSlug = prompt('Enter new slug (6 < 64 chars)', makeSuggestion ? suggestion : '');
    if (!newSlug) return;

    const exists = slugs.find((s) => s.slug === newSlug);
    if (exists) {
      alert('slug already exists');
      return;
    }

    fetcher.submit(
      { slug: newSlug, formAction: 'slug-add', submission_id: submissionId, site_id: siteId },
      { method: 'POST' },
    );
  };

  const handleRemove = (e: React.FormEvent<HTMLFormElement>, slug_id: string, slug: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      confirm(
        `Are you sure you want to remove "${slug}"? this break existing external links to the submission that use this slug.`,
      ) === false
    )
      return;

    fetcher.submit({ slug_id, formAction: 'slug-remove' }, { method: 'POST' });
  };

  const handleSetPrimary = (e: React.FormEvent<HTMLFormElement>, slug_id: string, slug: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      confirm(
        `Are you sure you want to set "${slug}" as the primary slug? this will redirect all other slugs to here.`,
      ) === false
    )
      return;

    fetcher.submit({ slug_id, formAction: 'slug-set-primary' }, { method: 'POST' });
  };

  const slug = slugs.find((s) => s.primary)?.slug ?? slugs[0]?.slug ?? fallback;

  const tick = <SquareCheckBig className="inline-block w-4 h-4 mb-[2px] stroke-green-600" />;
  const cardContent = (
    <div className="text-md">
      <table>
        <thead>
          <tr className="border-b-[1px] border-gray-500 bg-gray-100">
            <th className="px-3 py-1 text-left">primary</th>
            <th className="px-3 py-1 text-left">slug</th>
            <th className="px-3 py-1 text-left">updated</th>
            <th className="px-3 py-1 text-left align-text-bottom" title="set as primary">
              <SquareCheckBig className="inline-block w-4 h-4" />
            </th>
            <th className="px-3 py-1 text-left align-text-bottom" title="remove slug">
              <Trash2 className="inline-block w-4 h-4 opacity-80 hover:opacity-100" />
            </th>
          </tr>
        </thead>
        <tbody>
          {slugs.map((s) => {
            const deleting =
              fetcher.state === 'submitting' &&
              fetcher.formData?.get('formAction') === 'slug-remove' &&
              fetcher.formData?.get('slug_id') === s.id;
            return (
              <tr
                key={s.id}
                className={classNames('even:bg-gray-50', {
                  'text-gray-500 line-through': deleting,
                })}
              >
                <td className="px-3 py-1 text-center pointer-events-none">
                  {s.primary && <>{tick}</>}
                </td>
                <td className="px-3 py-1 text-left">
                  <a
                    className="underline cursor-pointer"
                    href={`${baseUrl}${s.slug}`}
                    target="_blank"
                    rel="noopener noreferer"
                  >
                    {s.slug}
                  </a>
                </td>
                <td className="px-3 py-1 text-left pointer-events-none">
                  {formatDistanceToNow(new Date(s.date_modified))} ago
                </td>
                <td className="px-3 py-1 text-center">
                  <fetcher.Form onSubmit={(e) => handleSetPrimary(e, s.id, s.slug)}>
                    <button className="align-text-bottom" type="submit" title="set as primary">
                      <SquareCheckBig className="inline-block w-4 h-4 opacity-80 hover:opacity-100" />
                    </button>
                  </fetcher.Form>
                </td>
                <td className="px-3 py-1 text-center">
                  <fetcher.Form onSubmit={(e) => handleRemove(e, s.id, s.slug)}>
                    <button className="align-text-bottom" type="submit" title="remove slug">
                      <Trash2 className="inline-block w-4 h-4 opacity-80 hover:opacity-100" />
                    </button>
                  </fetcher.Form>
                </td>
              </tr>
            );
          })}
          <tr className="even:bg-gray-50">
            <td className="px-3 py-1 text-center">{slugs.length === 0 && <>{tick}</>}</td>
            <td className="px-3 py-1 text-left underline">
              <a
                className="underline cursor-pointer"
                href={`${baseUrl}${fallback}`}
                target="_blank"
                rel="noopener noreferer"
              >
                {fallback}
              </a>
            </td>
            <td className="px-3 py-1 text-left text-gray-400">default</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div className="pt-2 text-right *:align-middle cursor-pointer" onClick={handleAdd}>
        <CirclePlus className="inline-block w-4 h-4 mr-1" />
        <span className="underline">Add A Slug</span>
      </div>
    </div>
  );

  return (
    <>
      <div>Slug</div>
      <primitives.PopoverWrapper
        className="min-w-[310px] z-20 p-6 pb-4"
        skip={slugs.length === 0}
        content={cardContent}
      >
        <div className="flex flex-col items-right">
          <div
            className={classNames('text-right', { 'underline cursor-pointer': canEdit })}
            onClick={handleAddFirstSlug}
          >
            {slug}
            {canEdit && <SquarePen className="inline-block w-4 h-4 ml-[2px] mb-[2px]" />}
          </div>
          {fetcher.data?.error && <div className="text-xs text-red-600">{fetcher.data.error}</div>}
        </div>
      </primitives.PopoverWrapper>
    </>
  );
}
