import { Plus, CornerDownLeft } from 'lucide-react';
import { ui } from '@curvenote/scms-core';

export type AddAuthorPlaceholderCardProps = {
  orcidSearchExternalOptions?: { value: string; label: string; description?: string }[];
  orcidSearchLoading?: boolean;
  onAuthorSelect: (orcid: string) => void;
  onSearchChange: (query: string) => void;
  addAuthorSearchValue: string;
  handleAddAuthor: () => void;
  orcidFetcher: { state: string };
  addMeAsAuthor: () => void;
  showAddMeAsAuthor: boolean;
  isEmpty: boolean;
};

export function AddAuthorPlaceholderCard({
  orcidSearchExternalOptions,
  orcidSearchLoading,
  onAuthorSelect,
  onSearchChange,
  addAuthorSearchValue,
  handleAddAuthor,
  orcidFetcher,
  addMeAsAuthor,
  showAddMeAsAuthor,
  isEmpty,
}: AddAuthorPlaceholderCardProps) {
  return (
    <div className="flex gap-3 items-start p-4 rounded-sm border border-dashed border-border bg-background">
      <div className="flex-1 space-y-2 min-w-0">
        {isEmpty && showAddMeAsAuthor && (
          <div className="flex flex-wrap gap-2 items-center">
            <ui.Button
              type="button"
              variant="default"
              onClick={addMeAsAuthor}
              className="cursor-pointer w-fit"
            >
              Add me as an author
            </ui.Button>
            <span className="text-sm text-muted-foreground">or search for authors:</span>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-0">
            <ui.AsyncComboBox
              triggerMode="inline"
              value=""
              onValueChange={onAuthorSelect}
              onSearch={async () => []}
              onSearchChange={onSearchChange}
              externalOptions={orcidSearchExternalOptions ?? []}
              externalLoading={orcidSearchLoading}
              placeholder="Name or ORCID (e.g. 0000-0002-1825-0097)"
              searchPlaceholder="Search ORCID…"
              minSearchLength={1}
              emptyMessage="No ORCID matches."
              loadingMessage="Searching ORCID…"
              className="w-full"
            />
          </div>
          <ui.Button
            type="button"
            onClick={handleAddAuthor}
            disabled={!addAuthorSearchValue.trim() || orcidFetcher.state !== 'idle'}
            className="cursor-pointer shrink-0"
          >
            {orcidFetcher.state !== 'idle' ? (
              'Looking up…'
            ) : (
              <>
                Add Author
                <CornerDownLeft className="w-4 h-4" aria-hidden />
              </>
            )}
          </ui.Button>
        </div>
        {!isEmpty && showAddMeAsAuthor && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={addMeAsAuthor}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
            >
              <Plus className="w-3 h-3 shrink-0" aria-hidden />
              <span>Add me as an author</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
