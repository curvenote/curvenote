import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { uuidv7 as uuid } from 'uuidv7';
import {
  GripVertical,
  Building2,
  Pencil,
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Mail,
} from 'lucide-react';
import { OrcidIcon } from '@scienceicons/react/24/solid';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Author, Affiliation } from '../types.js';
import { isValidEmail, isValidOrcid } from '../validationUtils.js';
import { getAffiliationName } from './affiliationHelpers.js';
import { AffiliationSortableList } from './AffiliationSortableList.js';
import type { RorSearchHit } from './authorTypes.js';
import { ui } from '@curvenote/scms-core';

export type AuthorCardProps = {
  value: Author;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (author: Author) => void;
  onDelete: () => void;
  affiliationList: Affiliation[];
  onEnsureAffiliationInList: (aff: Affiliation) => void;
  onRenameAffiliation?: (affiliationId: string, newName: string) => void;
  onUpdateAffiliation?: (affiliationId: string, updates: Partial<Affiliation>) => void;
  affiliationInputRef?: React.RefObject<HTMLInputElement | null>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

export function AuthorCard({
  value,
  index,
  open,
  onOpenChange,
  onChange,
  onDelete,
  affiliationList,
  onEnsureAffiliationInList,
  onRenameAffiliation,
  onUpdateAffiliation,
  affiliationInputRef,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: AuthorCardProps) {
  const [editName, setEditName] = useState(value.name);
  const [editOrcid, setEditOrcid] = useState(value.orcid || '');
  const [editEmail, setEditEmail] = useState(value.email || '');
  const [editCorresponding, setEditCorresponding] = useState(value.corresponding || false);
  const [editAffiliationIds, setEditAffiliationIds] = useState<string[]>(
    value.affiliationIds ?? [],
  );
  const [newAffiliationInput, setNewAffiliationInput] = useState('');
  const [expandAddDetails, setExpandAddDetails] = useState(false);
  const [addDetailsName, setAddDetailsName] = useState('');
  const [addDetailsDepartment, setAddDetailsDepartment] = useState('');
  const [addDetailsCity, setAddDetailsCity] = useState('');
  const [addDetailsCountry, setAddDetailsCountry] = useState('');
  const lastRorResultsRef = useRef<RorSearchHit[]>([]);
  const lastSubmittedRorQRef = useRef('');
  const rorSearchFetcher = useFetcher();

  useEffect(() => {
    const trimmed = newAffiliationInput.trim();
    if (!trimmed) return;
    const t = setTimeout(() => {
      lastSubmittedRorQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-ror');
      fd.set('q', trimmed);
      rorSearchFetcher.submit(fd, { method: 'POST' });
    }, 300);
    return () => clearTimeout(t);
  }, [newAffiliationInput]);

  const rorSearchOptions = (() => {
    if (rorSearchFetcher.state !== 'idle' || !rorSearchFetcher.data) return undefined;
    const currentQ = newAffiliationInput.trim();
    if (currentQ !== lastSubmittedRorQRef.current) return undefined;
    const data = rorSearchFetcher.data as { results?: RorSearchHit[] };
    const results = data?.results ?? [];
    lastRorResultsRef.current = results;
    return results.map((r) => ({
      value: r.ror,
      label: r.name,
      description: [r.city, r.country].filter(Boolean).join(', ') || undefined,
    }));
  })();
  const rorSearchLoading = rorSearchFetcher.state !== 'idle';

  const onSelectRorSuggestion = (hit: RorSearchHit) => {
    const rorFields: string[] = ['name'];
    if (hit.city) rorFields.push('city');
    if (hit.country) rorFields.push('country');
    const aff: Affiliation = {
      id: uuid(),
      name: hit.name,
      ror: hit.ror,
      rorFields,
      ...(hit.city && { city: hit.city }),
      ...(hit.country && { country: hit.country }),
    };
    if (open) addAffiliation(aff);
    else addAffiliationInViewMode(aff);
    setNewAffiliationInput('');
  };

  const onRorSelectFromCombobox = (ror: string) => {
    const hit = lastRorResultsRef.current.find((r) => r.ror === ror);
    if (hit) onSelectRorSuggestion(hit);
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const pushAuthor = (updates: Partial<Author>) => {
    onChange({ ...value, ...updates });
  };

  const addAffiliation = (aff: Affiliation) => {
    if (editAffiliationIds.includes(aff.id)) return;
    onEnsureAffiliationInList(aff);
    const next = [...editAffiliationIds, aff.id];
    setEditAffiliationIds(next);
    pushAuthor({ affiliationIds: next });
  };

  const addAffiliationInViewMode = (aff: Affiliation) => {
    if ((value.affiliationIds ?? []).includes(aff.id)) return;
    onEnsureAffiliationInList(aff);
    onChange({
      ...value,
      affiliationIds: [...(value.affiliationIds ?? []), aff.id],
    });
  };

  useEffect(() => {
    setEditName(value.name);
    setEditOrcid(value.orcid || '');
    setEditEmail(value.email || '');
    setEditCorresponding(value.corresponding || false);
    setEditAffiliationIds(value.affiliationIds ?? []);
  }, [value]);

  const emailValid = editEmail.trim() === '' ? null : isValidEmail(editEmail);
  const orcidValid = editOrcid.trim() === '' ? null : isValidOrcid(editOrcid);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-3 items-start p-4 rounded-sm border bg-background ${
        isDragging ? 'shadow-lg border-primary' : 'border-border'
      }`}
    >
      <div className="flex flex-col gap-0.5 items-center pt-1 shrink-0">
        {onMoveUp != null && (
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 rounded touch-manipulation cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default text-muted-foreground hover:text-foreground"
            aria-label="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5"
          type="button"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
        </button>
        {onMoveDown != null && (
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-0.5 rounded touch-manipulation cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default text-muted-foreground hover:text-foreground"
            aria-label="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {open ? (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span
                  className={`text-base font-semibold ${editName.trim() ? '' : 'text-muted-foreground/60'}`}
                >
                  {editName.trim() || 'Author Name'}
                </span>
                {orcidValid === true && (value.orcid ?? editOrcid)?.trim() && (
                  <a
                    href={
                      (value.orcid ?? editOrcid)!.trim().startsWith('http')
                        ? (value.orcid ?? editOrcid)!.trim()
                        : `https://orcid.org/${(value.orcid ?? editOrcid)!.trim()}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline cursor-pointer shrink-0"
                    aria-label="View ORCID profile"
                  >
                    <OrcidIcon className="w-4 h-4 text-[#A6CE39]" aria-hidden />
                  </a>
                )}
                {editCorresponding && (
                  <Mail
                    className="w-4 h-4 text-muted-foreground shrink-0"
                    aria-label="Corresponding author"
                  />
                )}
              </div>
              {editAffiliationIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editAffiliationIds.map((affId) => {
                    const affName = getAffiliationName(affiliationList, affId);
                    return (
                      <ui.Badge
                        key={affId}
                        variant="outline-muted"
                        className="flex gap-1 items-center text-xs"
                      >
                        <Building2 className="w-3 h-3 shrink-0" />
                        {affName ? <span className="truncate max-w-[200px]">{affName}</span> : null}
                      </ui.Badge>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <hr className="border-border" />

            <div className="space-y-2">
              <ui.FormLabel
                htmlFor={`author-${index}-name`}
                required
                valid={editName.trim().length > 0}
                defined={editName.trim().length > 0}
              >
                Full Name
              </ui.FormLabel>
              <ui.Input
                id={`author-${index}-name`}
                type="text"
                autoComplete="off"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  pushAuthor({ name: e.target.value });
                }}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <OrcidIcon
                  className={`w-4 h-4 shrink-0 ${orcidValid === true ? 'text-[#A6CE39]' : 'text-muted-foreground'}`}
                  aria-hidden
                />
                <ui.FormLabel
                  htmlFor={`author-${index}-orcid`}
                  required={false}
                  valid={orcidValid === true}
                  defined={(editOrcid ?? '').trim().length > 0}
                >
                  ORCID
                </ui.FormLabel>
              </div>
              <ui.Input
                id={`author-${index}-orcid`}
                type="text"
                autoComplete="off"
                value={editOrcid}
                onChange={(e) => {
                  setEditOrcid(e.target.value);
                  pushAuthor({ orcid: e.target.value.trim() || undefined });
                }}
                placeholder="0000-0000-0000-0000"
              />
            </div>

            <div className="space-y-2">
              <ui.FormLabel
                htmlFor={`author-${index}-email`}
                required={editCorresponding}
                valid={emailValid === true}
                defined={(editEmail ?? '').trim().length > 0}
              >
                Email {editCorresponding && '(required for corresponding)'}
              </ui.FormLabel>
              <ui.Input
                id={`author-${index}-email`}
                type="email"
                autoComplete="off"
                value={editEmail}
                onChange={(e) => {
                  setEditEmail(e.target.value);
                  pushAuthor({ email: e.target.value.trim() || undefined });
                }}
                placeholder="email@example.com"
              />
            </div>

            <div className="flex gap-2 items-center">
              <ui.Checkbox
                id={`author-${index}-corresponding`}
                checked={editCorresponding}
                onCheckedChange={(checked) => {
                  setEditCorresponding(checked === true);
                  pushAuthor({ corresponding: checked === true });
                }}
              />
              <label
                htmlFor={`author-${index}-corresponding`}
                className="text-sm font-medium cursor-pointer"
              >
                Corresponding author
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Affiliations</label>
              <AffiliationSortableList
                affiliationIds={editAffiliationIds}
                affiliationList={affiliationList}
                onReorder={(newOrder) => {
                  setEditAffiliationIds(newOrder);
                  pushAuthor({ affiliationIds: newOrder });
                }}
                onRemove={(affiliationId) => {
                  const next = editAffiliationIds.filter((id) => id !== affiliationId);
                  setEditAffiliationIds(next);
                  pushAuthor({ affiliationIds: next });
                }}
                onRename={(affiliationId, newName) => {
                  onRenameAffiliation?.(affiliationId, newName.trim());
                }}
                onUpdate={(affiliationId, updates) => {
                  onUpdateAffiliation?.(affiliationId, updates);
                }}
                authorId={value.id}
              />
              <div className="flex gap-2 items-center">
                <div className="relative flex-1 min-w-0">
                  <ui.AsyncComboBox
                    triggerMode="inline"
                    value=""
                    searchValue={newAffiliationInput}
                    onValueChange={onRorSelectFromCombobox}
                    onSearch={async () => []}
                    onSearchChange={setNewAffiliationInput}
                    externalOptions={rorSearchOptions ?? []}
                    externalLoading={rorSearchLoading}
                    placeholder="Add affiliation (search ROR)"
                    searchPlaceholder="Search ROR…"
                    minSearchLength={1}
                    emptyMessage="No ROR matches."
                    loadingMessage="Searching ROR…"
                    className="w-full"
                  />
                </div>
                <ui.Button
                  type="button"
                  variant="default"
                  disabled={!newAffiliationInput.trim()}
                  className="cursor-pointer shrink-0"
                  onClick={() => {
                    const trimmed = newAffiliationInput.trim();
                    if (trimmed) {
                      addAffiliation({ id: uuid(), name: trimmed });
                      setNewAffiliationInput('');
                    }
                  }}
                >
                  Add
                </ui.Button>
              </div>
              {(() => {
                const otherOptions = affiliationList.filter(
                  (a) => !editAffiliationIds.includes(a.id),
                );
                const typed = (newAffiliationInput ?? '').trim();
                const hasTypedNonMatching =
                  typed !== '' &&
                  !otherOptions.some(
                    (a) => (a.name ?? '').trim().toLowerCase() === typed.toLowerCase(),
                  );
                const showAddDetailsPrompt =
                  typed !== '' && (otherOptions.length === 0 || hasTypedNonMatching);

                if (showAddDetailsPrompt) {
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandAddDetails((e) => !e);
                            if (!expandAddDetails) setAddDetailsName(typed || '');
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
                          aria-expanded={expandAddDetails}
                        >
                          {expandAddDetails ? (
                            <Minus className="w-3 h-3 shrink-0" aria-hidden />
                          ) : (
                            <Plus className="w-3 h-3 shrink-0" aria-hidden />
                          )}
                          <span>Add department or location</span>
                        </button>
                      </div>
                      {expandAddDetails && (
                        <div className="pl-6 space-y-3 border-l-2 border-border">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Name
                            </label>
                            <ui.Input
                              type="text"
                              autoComplete="off"
                              value={addDetailsName}
                              onChange={(e) => setAddDetailsName(e.target.value)}
                              placeholder="Affiliation name"
                              className="w-full h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Department
                            </label>
                            <ui.Input
                              type="text"
                              autoComplete="off"
                              value={addDetailsDepartment}
                              onChange={(e) => setAddDetailsDepartment(e.target.value)}
                              placeholder="Department"
                              className="w-full h-9 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                City
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsCity}
                                onChange={(e) => setAddDetailsCity(e.target.value)}
                                placeholder="City"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Country
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsCountry}
                                onChange={(e) => setAddDetailsCountry(e.target.value)}
                                placeholder="Country"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {otherOptions.map((aff) => (
                      <button
                        key={aff.id}
                        type="button"
                        onClick={() => addAffiliation(aff)}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                        {aff.name}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <span
                className={`text-base font-semibold ${value.name?.trim() ? '' : 'text-muted-foreground/60'}`}
              >
                {value.name?.trim() || 'Author Name'}
              </span>
              {orcidValid === true && value.orcid?.trim() && (
                <a
                  href={
                    value.orcid.trim().startsWith('http')
                      ? value.orcid.trim()
                      : `https://orcid.org/${value.orcid.trim()}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline cursor-pointer shrink-0"
                  aria-label="View ORCID profile"
                >
                  <OrcidIcon className="w-4 h-4 text-[#A6CE39]" aria-hidden />
                </a>
              )}
              {value.corresponding && (
                <Mail
                  className="w-4 h-4 text-muted-foreground shrink-0"
                  aria-label="Corresponding author"
                />
              )}
            </div>

            {value.affiliationIds && value.affiliationIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {value.affiliationIds.map((affId) => {
                  const affName = getAffiliationName(affiliationList, affId);
                  return (
                    <ui.Badge
                      key={affId}
                      variant="outline-muted"
                      className="flex gap-1 items-center text-xs"
                    >
                      <Building2 className="w-3 h-3 shrink-0" />
                      {affName ? (
                        <span className="truncate max-w-[200px]" title={affName}>
                          {affName}
                        </span>
                      ) : null}
                    </ui.Badge>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <div
                    className="relative flex-1 min-w-0"
                    ref={affiliationInputRef as React.RefObject<HTMLDivElement>}
                  >
                    <ui.AsyncComboBox
                      triggerMode="inline"
                      value=""
                      searchValue={newAffiliationInput}
                      onValueChange={onRorSelectFromCombobox}
                      onSearch={async () => []}
                      onSearchChange={setNewAffiliationInput}
                      externalOptions={rorSearchOptions ?? []}
                      externalLoading={rorSearchLoading}
                      placeholder="Add affiliation (search ROR)"
                      searchPlaceholder="Search ROR…"
                      minSearchLength={1}
                      emptyMessage="No ROR matches."
                      loadingMessage="Searching ROR…"
                      className="w-full"
                    />
                  </div>
                  <ui.Button
                    type="button"
                    variant="default"
                    disabled={!newAffiliationInput.trim()}
                    className="cursor-pointer shrink-0"
                    onClick={() => {
                      const trimmed = newAffiliationInput.trim();
                      if (trimmed) {
                        addAffiliationInViewMode({ id: uuid(), name: trimmed });
                        setNewAffiliationInput('');
                      }
                    }}
                  >
                    Add
                  </ui.Button>
                </div>
                {(() => {
                  const otherOptions = affiliationList.filter(
                    (a) => !(value.affiliationIds ?? []).includes(a.id),
                  );
                  const typed = (newAffiliationInput ?? '').trim();
                  const hasTypedNonMatching =
                    typed !== '' &&
                    !otherOptions.some(
                      (a) => (a.name ?? '').trim().toLowerCase() === typed.toLowerCase(),
                    );
                  const showAddDetailsPrompt =
                    typed !== '' && (otherOptions.length === 0 || hasTypedNonMatching);

                  if (showAddDetailsPrompt) {
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandAddDetails((e) => !e);
                              if (!expandAddDetails) setAddDetailsName(typed || '');
                            }}
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
                            aria-expanded={expandAddDetails}
                          >
                            {expandAddDetails ? (
                              <Minus className="w-3 h-3 shrink-0" aria-hidden />
                            ) : (
                              <Plus className="w-3 h-3 shrink-0" aria-hidden />
                            )}
                            <span>Add department or location</span>
                          </button>
                        </div>
                        {expandAddDetails && (
                          <div className="pl-6 space-y-3 border-l-2 border-border">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Name
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsName}
                                onChange={(e) => setAddDetailsName(e.target.value)}
                                placeholder="Affiliation name"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Department
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsDepartment}
                                onChange={(e) => setAddDetailsDepartment(e.target.value)}
                                placeholder="Department"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                  City
                                </label>
                                <ui.Input
                                  type="text"
                                  autoComplete="off"
                                  value={addDetailsCity}
                                  onChange={(e) => setAddDetailsCity(e.target.value)}
                                  placeholder="City"
                                  className="w-full h-9 text-sm"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Country
                                </label>
                                <ui.Input
                                  type="text"
                                  autoComplete="off"
                                  value={addDetailsCountry}
                                  onChange={(e) => setAddDetailsCountry(e.target.value)}
                                  placeholder="Country"
                                  className="w-full h-9 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {otherOptions.map((aff) => (
                        <button
                          key={aff.id}
                          type="button"
                          onClick={() => addAffiliationInViewMode(aff)}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
                        >
                          <Plus className="w-3 h-3 shrink-0" />
                          {aff.name}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-1 items-start shrink-0">
        {open ? (
          <ui.Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onOpenChange(false)}
            aria-label="Collapse"
            className="cursor-pointer"
          >
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          </ui.Button>
        ) : (
          <ui.Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onOpenChange(true)}
            aria-label="Edit author"
            className="cursor-pointer"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </ui.Button>
        )}
        <ui.Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          aria-label="Delete author"
          className="cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </ui.Button>
      </div>
    </div>
  );
}
