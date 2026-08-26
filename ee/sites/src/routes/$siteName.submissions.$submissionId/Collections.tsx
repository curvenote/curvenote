import type { SubmissionEditorCollection } from './types.js';
import { DetailFieldEditorShell, DetailFieldEditorTrigger } from './DetailFieldEditor.js';
import { AttributeChangeDialog } from './AttributeChangeDialog.js';
import {
  buildAttributeChangeOptions,
  getOptimisticNameOrTitle,
  resolveCollectionChangeOutcome,
} from './AttributeChangeDialog.utils.js';
import { useAttributeChangeDialog } from './useAttributeChangeDialog.js';

type CollectionsProps = {
  submissionId: string;
  collectionId: string;
  collections: SubmissionEditorCollection[];
  canUpdate: boolean;
};

export function Collections({
  submissionId,
  collectionId,
  collections,
  canUpdate,
}: CollectionsProps) {
  const { open, handleOpenChange, beginSubmit, fetcher } = useAttributeChangeDialog<{
    error?: string;
    collection?: { id: string; name: string };
  }>({ resolveOutcome: resolveCollectionChangeOutcome });

  const current = collections.find((c) => c.id === collectionId);
  const options = buildAttributeChangeOptions(collections);

  const handleConfirm = (newCollectionId: string, nameOrTitle: string) => {
    beginSubmit();
    fetcher.submit(
      {
        submission_id: submissionId,
        collection_id: newCollectionId,
        name_or_title: nameOrTitle,
        formAction: 'set-collection',
      },
      { method: 'POST' },
    );
  };

  const collectionTitle = getOptimisticNameOrTitle(
    fetcher.formData,
    current?.content?.title,
    current?.name,
    'Unknown',
  );
  const collectionName = current?.content?.name;

  return (
    <div className="w-full min-w-0">
      <DetailFieldEditorShell value={collectionTitle ?? collectionName ?? 'unknown'}>
        {canUpdate && (
          <DetailFieldEditorTrigger
            title="Change collection"
            onClick={() => handleOpenChange(true)}
          />
        )}
      </DetailFieldEditorShell>
      {canUpdate && (
        <AttributeChangeDialog
          open={open}
          onOpenChange={handleOpenChange}
          title="Change collection"
          calloutType="warning"
          calloutMessage="Changing the collection may change the workflow that applies to this submission. The current kind may no longer be valid for the new collection and would need to be updated."
          options={options}
          currentId={collectionId}
          confirmLabel="Change collection"
          isSubmitting={fetcher.state !== 'idle'}
          error={fetcher.data?.error}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
