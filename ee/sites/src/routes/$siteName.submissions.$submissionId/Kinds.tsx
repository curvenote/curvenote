import type { SubmissionEditorCollection } from './types.js';
import { DetailFieldEditorShell, DetailFieldEditorTrigger } from './DetailFieldEditor.js';
import { AttributeChangeDialog } from './AttributeChangeDialog.js';
import {
  buildAttributeChangeOptions,
  getOptimisticNameOrTitle,
  resolveKindChangeOutcome,
} from './AttributeChangeDialog.utils.js';
import { useAttributeChangeDialog } from './useAttributeChangeDialog.js';

type KindsProps = {
  submissionId: string;
  collection?: SubmissionEditorCollection;
  kindId: string;
  kindNameOrTitle: string;
  canUpdate: boolean;
};

export function Kinds({
  submissionId,
  collection,
  kindId,
  kindNameOrTitle,
  canUpdate,
}: KindsProps) {
  const { open, handleOpenChange, beginSubmit, fetcher } = useAttributeChangeDialog<{
    error?: string;
    kindId: string;
    kindName: string;
  }>({ resolveOutcome: resolveKindChangeOutcome });

  const kinds = collection?.kinds ?? [];
  const submissionKindMatch = kinds.some((kind) => kind.id === kindId);
  const current = kinds.find((k) => k.id === kindId);
  const options = buildAttributeChangeOptions(kinds);
  const canChangeKind = canUpdate && collection != null;

  const handleConfirm = (newKindId: string, nameOrTitle: string) => {
    if (!collection) {
      return;
    }
    beginSubmit();
    fetcher.submit(
      {
        submission_id: submissionId,
        collection_id: collection.id,
        kind_id: newKindId,
        name_or_title: nameOrTitle,
        formAction: 'set-kind',
      },
      { method: 'POST' },
    );
  };

  const kindTitle = getOptimisticNameOrTitle(
    fetcher.formData,
    current?.content?.title,
    current?.name,
    kindNameOrTitle,
  );

  return (
    <div className="w-full min-w-0">
      <DetailFieldEditorShell
        value={kindTitle ?? current?.name}
        valueClassName={!submissionKindMatch ? 'font-semibold text-destructive' : undefined}
      >
        {canChangeKind && (
          <DetailFieldEditorTrigger title="Change kind" onClick={() => handleOpenChange(true)} />
        )}
      </DetailFieldEditorShell>
      {canChangeKind && (
        <AttributeChangeDialog
          open={open}
          onOpenChange={handleOpenChange}
          title="Change submission kind"
          calloutType="info"
          calloutMessage="This changes how the submission is classified within its collection."
          options={options}
          currentId={kindId}
          confirmLabel="Change kind"
          isSubmitting={fetcher.state !== 'idle'}
          error={fetcher.data?.error}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
