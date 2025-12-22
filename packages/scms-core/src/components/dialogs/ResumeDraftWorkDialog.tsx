import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { plural } from '../../utils/plural.js';

/**
 * Base draft work type - can be extended for specific use cases
 */
export interface DraftWork {
  workId: string;
  workVersionId: string;
  workTitle: string;
  dateModified: string;
  dateCreated: string;
  metadata?: any;
}

/**
 * Props for the ResumeDraftWorkDialog component
 */
interface ResumeDraftWorkDialogProps<T extends DraftWork> {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onResume: (draft: T) => void;
  fetchAction: string;
  fetchIntent?: string;
  deleteAction: string;
  deleteIntent?: string;
  deleteAllIntent?: string;
  title?: string;
  description?: React.ReactNode;
  renderItemDetails?: (draft: T) => React.ReactNode;
  objectLabel?: string;
  createButtonLabel?: string;
  resumeButtonLabel?: string;
}

/**
 * Props for DeleteConfirmationDialog
 */
interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workId?: string;
  title: string;
  description: string;
  confirmButtonText: string;
  onDeleted: () => void;
  deleteAction: string;
  deleteIntent: string;
}

/**
 * Delete confirmation dialog component
 * Can be used for single delete or delete-all operations
 */
function DeleteConfirmationDialog({
  isOpen,
  onClose,
  workId,
  title,
  description,
  confirmButtonText,
  onDeleted,
  deleteAction,
  deleteIntent,
}: DeleteConfirmationDialogProps) {
  const fetcher = useFetcher();
  const [hasHandledSuccess, setHasHandledSuccess] = useState(false);

  const handleDelete = () => {
    setHasHandledSuccess(false);
    const formData = new FormData();
    formData.append('intent', deleteIntent);
    if (workId) {
      formData.append('workId', workId);
    }

    fetcher.submit(formData, {
      method: 'post',
      action: deleteAction,
    });
  };

  // Handle successful deletion
  useEffect(() => {
    if (
      !hasHandledSuccess &&
      fetcher.data &&
      typeof fetcher.data === 'object' &&
      'success' in fetcher.data &&
      (fetcher.data as any).success &&
      fetcher.state === 'idle'
    ) {
      setHasHandledSuccess(true);
      onDeleted();
      onClose();
    }
  }, [fetcher.data, fetcher.state, hasHandledSuccess, onDeleted, onClose]);

  // Reset success handling state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setHasHandledSuccess(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={fetcher.state !== 'idle'}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={fetcher.state !== 'idle'}>
            {fetcher.state !== 'idle' ? 'Deleting...' : confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Props for DraftWorkItem
 */
interface DraftWorkItemProps<T extends DraftWork> {
  draft: T;
  onDeleted: () => void;
  onResume: (draft: T) => void;
  renderDetails?: (draft: T) => React.ReactNode;
  deleteAction: string;
  deleteIntent: string;
  resumeButtonLabel?: string;
}

/**
 * Individual draft work item component
 */
function DraftWorkItem<T extends DraftWork>({
  draft,
  onDeleted,
  onResume,
  renderDetails,
  deleteAction,
  deleteIntent,
  resumeButtonLabel = 'Resume Work',
}: DraftWorkItemProps<T>) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fetcher = useFetcher();

  const handleResume = () => {
    onResume(draft);
  };

  const timeAgo = formatDistanceToNow(new Date(draft.dateModified), { addSuffix: true });
  const createdAgo = formatDistanceToNow(new Date(draft.dateCreated), { addSuffix: true });

  return (
    <>
      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <div className="text-sm font-medium text-muted-foreground">
                Last modified {timeAgo}
              </div>
              <div className="mb-3 text-xs text-muted-foreground">Created {createdAgo}</div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 hover:text-red-700"
              disabled={fetcher.state !== 'idle'}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-medium text-gray-900 truncate">{draft.workTitle}</h3>
          </div>
          {renderDetails && (
            <div className="mb-1 text-sm text-muted-foreground">{renderDetails(draft)}</div>
          )}
          <Button
            onClick={handleResume}
            className="w-full mt-2"
            disabled={fetcher.state !== 'idle'}
          >
            {resumeButtonLabel}
          </Button>
        </div>
      </div>

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        workId={draft.workId}
        title="Delete Draft Work"
        description={`Are you sure you want to delete the draft work "${draft.workTitle}"? This action cannot be undone.`}
        confirmButtonText="Delete Draft"
        onDeleted={onDeleted}
        deleteAction={deleteAction}
        deleteIntent={deleteIntent}
      />
    </>
  );
}

/**
 * Props for DraftWorkList
 */
interface DraftWorkListProps<T extends DraftWork> {
  drafts: T[];
  onDeleted: () => void;
  onResume: (draft: T) => void;
  renderDetails?: (draft: T) => React.ReactNode;
  deleteAction: string;
  deleteIntent: string;
  resumeButtonLabel?: string;
}

/**
 * List of draft works component
 */
function DraftWorkList<T extends DraftWork>({
  drafts,
  onDeleted,
  onResume,
  renderDetails,
  deleteAction,
  deleteIntent,
  resumeButtonLabel,
}: DraftWorkListProps<T>) {
  if (drafts.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No draft works found.</div>;
  }

  // Sort drafts by dateModified in descending order (most recent first)
  const sortedDrafts = [...drafts].sort(
    (a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime(),
  );

  return (
    <div className="space-y-3">
      {sortedDrafts.map((draft) => (
        <DraftWorkItem
          key={draft.workId}
          draft={draft}
          onDeleted={onDeleted}
          onResume={onResume}
          renderDetails={renderDetails}
          deleteAction={deleteAction}
          deleteIntent={deleteIntent}
          resumeButtonLabel={resumeButtonLabel}
        />
      ))}
    </div>
  );
}

/**
 * Main dialog component for resuming draft works
 * Generic component that can be used for different types of draft works
 */
export function ResumeDraftWorkDialog<T extends DraftWork>({
  isOpen,
  onClose,
  onCreateNew,
  onResume,
  fetchAction,
  fetchIntent = 'get-drafts',
  deleteAction,
  deleteIntent = 'delete-draft',
  deleteAllIntent = 'delete-all-drafts',
  title = 'Resume Previous Work',
  description,
  renderItemDetails,
  objectLabel = 'work',
  createButtonLabel = 'Create New Work',
  resumeButtonLabel = 'Resume Work',
}: ResumeDraftWorkDialogProps<T>) {
  const fetcher = useFetcher<{ drafts: T[] }>();
  const [drafts, setDrafts] = useState<T[]>([]);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  // Fetch drafts when dialog opens
  useEffect(() => {
    if (isOpen && fetcher.state === 'idle' && !fetcher.data) {
      const formData = new FormData();
      formData.append('intent', fetchIntent);
      fetcher.submit(formData, {
        method: 'post',
        action: fetchAction,
      });
    }
  }, [isOpen, fetcher.state, fetcher.data, fetchAction, fetchIntent]);

  // Update drafts when data is received
  useEffect(() => {
    if (fetcher.data?.drafts) {
      setDrafts(fetcher.data.drafts as T[]);
    }
  }, [fetcher.data]);

  const handleDeleted = () => {
    // Refresh the drafts list after deletion
    const formData = new FormData();
    formData.append('intent', fetchIntent);

    fetcher.submit(formData, {
      method: 'post',
      action: fetchAction,
    });
  };

  const handleResume = (draft: T) => {
    onResume(draft);
    onClose();
  };

  const handleCreateNew = () => {
    onCreateNew();
    onClose();
  };

  const handleDeleteAll = () => {
    // Show confirmation dialog
    setShowDeleteAllDialog(true);
  };

  const handleDeleteAllConfirmed = () => {
    // Refresh the drafts list after deletion
    const formData = new FormData();
    formData.append('intent', fetchIntent);

    fetcher.submit(formData, {
      method: 'post',
      action: fetchAction,
    });
  };

  const defaultDescription = (
    <div>
      You already have <span className="font-bold">{drafts.length}</span> draft{' '}
      {plural(`${objectLabel}(s)`, drafts.length)}. {resumeButtonLabel} one of them,{' '}
      <Button className="inline-block h-auto py-0" variant="link" onClick={handleCreateNew}>
        create a new {objectLabel}
      </Button>{' '}
      or{' '}
      <Button className="inline-block h-auto py-0" variant="link" onClick={handleDeleteAll}>
        delete them all
      </Button>
      .
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent variant="wide">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description ?? defaultDescription}</DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto py-4 max-h-[50vh]">
            {fetcher.state === 'loading' || fetcher.state === 'submitting' ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size={32} color="text-blue-600" thickness={4} />
              </div>
            ) : (
              <DraftWorkList
                drafts={drafts}
                onDeleted={handleDeleted}
                onResume={handleResume}
                renderDetails={renderItemDetails}
                deleteAction={deleteAction}
                deleteIntent={deleteIntent}
                resumeButtonLabel={resumeButtonLabel}
              />
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleCreateNew}>{createButtonLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={showDeleteAllDialog}
        onClose={() => setShowDeleteAllDialog(false)}
        title="Delete All Drafts"
        description={`Are you sure you want to delete all ${drafts.length} draft ${plural(`${objectLabel}(s)`, drafts.length)}? This action cannot be undone.`}
        confirmButtonText={`Delete All ${drafts.length} ${plural('Draft(s)', drafts.length)}`}
        onDeleted={handleDeleteAllConfirmed}
        deleteAction={deleteAction}
        deleteIntent={deleteAllIntent}
      />
    </>
  );
}
