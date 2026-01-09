import type { FetcherWithComponents } from 'react-router';
import { useNavigate } from 'react-router';
import type { CollectionSummaryDTO, JobDTO } from '@curvenote/common';
import { primitives } from '@curvenote/scms-core';
import type { AugmentedSubmissionsListWithPagination } from './types.js';

export function CollectionSelect({
  collections,
  fetcher,
  defaultValue,
}: {
  fetcher: FetcherWithComponents<{
    submissions?: AugmentedSubmissionsListWithPagination;
    error?: string;
    jobs: { items: JobDTO[] };
  }>;
  collections: CollectionSummaryDTO[];
  defaultValue?: string;
}) {
  const navigate = useNavigate();

  const handleCollectionSelect = async (collection: string) => {
    const formData = new FormData();
    formData.append('intent', 'filter-collection');
    formData.append('collection', collection);
    fetcher.submit(formData, { method: 'post' });

    // Update URL without page reload
    const searchParams = new URLSearchParams(window.location.search);
    if (collection === 'all') {
      searchParams.delete('collection');
    } else {
      searchParams.set('collection', collection);
    }
    console.log('navigate', searchParams.toString());
    navigate(`?${searchParams.toString()}`);
  };

  return (
    <div className="flex items-center gap-4 mb-2">
      <div>Show:</div>
      <primitives.Select
        placeholder="All Collections"
        ariaLabel="select collections"
        defaultValue={defaultValue ?? 'all'}
        onValueChange={handleCollectionSelect}
      >
        <primitives.SelectItem value="all">All Collections</primitives.SelectItem>
        <primitives.SelectSeparator />
        {collections.map((c) => (
          <primitives.SelectItem key={c.id} value={c.name}>
            {c.content?.title ?? c.name}
          </primitives.SelectItem>
        ))}
      </primitives.Select>
    </div>
  );
}
