import { useEffect, useState } from 'react';
import type { FetcherWithComponents } from 'react-router';
import { Link, useFetcher } from 'react-router';
import { Info } from 'lucide-react';
import { DOI_CONTENT_TYPE, cn, isDoiContentType, ui } from '@curvenote/scms-core';
import type { DoiContentType } from '@curvenote/scms-core';
import type { EligibleKindDTO } from '../../backend/doi/types.js';
import { DOI_CONTENT_TYPE_LABELS } from './doi.utils.js';
import type { DoiActionData } from './doi.utils.js';
import {
  draftFromKinds,
  draftToField,
  isDraftDirty,
  savedMappingKey,
  setEligible,
} from './eligibleKinds.utils.js';

const COLUMNS = 'grid grid-cols-2 gap-4 items-center px-4';

type EligibleKindRowProps = {
  kind: EligibleKindDTO;
  value: DoiContentType | null;
  busy: boolean;
  onEligibleChange: (eligible: boolean) => void;
  onContentTypeChange: (value: DoiContentType) => void;
};

function EligibleKindRow({
  kind,
  value,
  busy,
  onEligibleChange,
  onContentTypeChange,
}: EligibleKindRowProps) {
  const checkboxId = `doi-kind-${kind.id}`;
  const eligible = value !== null;
  return (
    <li className={cn('py-3', !eligible && 'bg-stone-50 dark:bg-stone-800/50')}>
      <div className={COLUMNS}>
        <div className="flex gap-3 items-center">
          <ui.Checkbox
            id={checkboxId}
            checked={eligible}
            disabled={busy}
            onCheckedChange={(checked) => onEligibleChange(checked === true)}
          />
          <label
            htmlFor={checkboxId}
            className={cn('text-sm font-medium', !eligible && 'text-muted-foreground')}
          >
            {kind.title}
          </label>
        </div>
        <ui.Select
          value={value ?? ''}
          onValueChange={(next) => {
            if (isDoiContentType(next)) {
              onContentTypeChange(next);
            }
          }}
          disabled={busy || !eligible}
        >
          <ui.SelectTrigger className="w-full" aria-label={`DOI content type for ${kind.title}`}>
            <ui.SelectValue placeholder="Select…" />
          </ui.SelectTrigger>
          <ui.SelectContent>
            {Object.values(DOI_CONTENT_TYPE).map((type) => (
              <ui.SelectItem key={type} value={type}>
                {DOI_CONTENT_TYPE_LABELS[type]}
              </ui.SelectItem>
            ))}
          </ui.SelectContent>
        </ui.Select>
      </div>
    </li>
  );
}

type EligibleKindsFormProps = {
  kinds: EligibleKindDTO[];
  fetcher: FetcherWithComponents<DoiActionData>;
  /** The note under the table; it sits between the rows and the actions. */
  children: React.ReactNode;
};

/** Owns the draft. The card owns the fetcher, so its toast survives the remount after a save. */
function EligibleKindsForm({ kinds, fetcher, children }: EligibleKindsFormProps) {
  const [draft, setDraft] = useState(() => draftFromKinds(kinds));
  const dirty = isDraftDirty(kinds, draft);
  const busy = fetcher.state !== 'idle';
  return (
    <fetcher.Form method="POST" className="m-0 space-y-4">
      <input type="hidden" name="intent" value="update-kind-mapping" />
      <input type="hidden" name="kinds" value={draftToField(kinds, draft)} />
      <div className="overflow-hidden rounded-sm border border-stone-200 dark:border-stone-600">
        <div
          className={cn(
            COLUMNS,
            'py-3 text-xs tracking-wide uppercase border-b text-muted-foreground',
            'border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800',
          )}
        >
          <div>Submission Kind</div>
          <div>DOI content type</div>
        </div>
        <ul className="divide-y divide-stone-200 dark:divide-stone-600">
          {kinds.map((kind) => (
            <EligibleKindRow
              key={kind.id}
              kind={kind}
              value={draft[kind.id] ?? null}
              busy={busy}
              onEligibleChange={(eligible) => setDraft(setEligible(draft, kind.id, eligible))}
              onContentTypeChange={(value) => setDraft({ ...draft, [kind.id]: value })}
            />
          ))}
        </ul>
      </div>
      {children}
      <div className="flex justify-end space-x-3">
        <ui.Button
          type="button"
          variant="secondary"
          disabled={!dirty || busy}
          onClick={() => setDraft(draftFromKinds(kinds))}
        >
          Discard
        </ui.Button>
        <ui.StatefulButton type="submit" disabled={!dirty} busy={busy} overlayBusy>
          Save
        </ui.StatefulButton>
      </div>
    </fetcher.Form>
  );
}

type NewKindsNoteProps = {
  kindsUrl: string;
};

function NewKindsNote({ kindsUrl }: NewKindsNoteProps) {
  return (
    <div className="flex gap-2 items-center px-4 py-3 rounded-sm border border-stone-200 bg-stone-50 text-muted-foreground dark:border-stone-600 dark:bg-stone-800">
      <Info className="w-4 h-4 shrink-0" aria-hidden />
      <p className="text-sm">
        Newly enabled Submission Kinds will automatically appear here for review.{' '}
        <Link to={kindsUrl} className="text-primary hover:underline">
          Manage Submission Kinds
        </Link>
      </p>
    </div>
  );
}

type DoiEligibleKindsCardProps = {
  kinds: EligibleKindDTO[];
  /** The site's Submission Kinds settings. */
  kindsUrl: string;
};

export function DoiEligibleKindsCard({ kinds, kindsUrl }: DoiEligibleKindsCardProps) {
  const fetcher = useFetcher<DoiActionData>();
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.error) {
        ui.toastError(fetcher.data.error);
      } else if (fetcher.data.info) {
        ui.toastSuccess(fetcher.data.info);
      }
    }
  }, [fetcher.state, fetcher.data]);
  const note = <NewKindsNote kindsUrl={kindsUrl} />;

  return (
    <ui.Card className="px-6 py-4 space-y-4">
      <div className="space-y-1">
        <h2>Eligible Submission Kinds</h2>
        <p className="text-sm font-light">
          Choose which enabled Submission Kinds can receive DOIs and how they should be registered.
        </p>
      </div>
      {kinds.length === 0 ? (
        <>
          <p className="text-sm text-muted-foreground">This Site has no Submission Kinds yet.</p>
          {note}
        </>
      ) : (
        // Keyed by the saved mapping: a save remounts the form, which reseeds the draft without an
        // effect.
        <EligibleKindsForm key={savedMappingKey(kinds)} kinds={kinds} fetcher={fetcher}>
          {note}
        </EligibleKindsForm>
      )}
    </ui.Card>
  );
}
