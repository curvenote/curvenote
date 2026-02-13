import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { uuidv7 as uuid } from 'uuidv7';
import { CornerDownLeft, GripVertical, Minus, Plus, Trash2 } from 'lucide-react';
import { OrcidIcon } from '@scienceicons/react/24/solid';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Author, Affiliation, AuthorOption } from '../types.js';
import {
  extractOrcidId,
  getAuthorFieldErrors,
  isValidOrcid,
  normalizeOrcidForCompare,
} from '../validationUtils.js';
import { useSaveField } from '../useSaveField.js';
import type { OrcidSearchHit, RorSearchHit } from './authorTypes.js';
import { AuthorCard } from './AuthorCard.js';
import { AddAuthorPlaceholderCard } from './AddAuthorPlaceholderCard.js';
import { AffiliationListItem } from './AffiliationListItem.js';
import { ui } from '@curvenote/scms-core';

export type ContactDetailsForAuthor = {
  name: string;
  email: string;
  orcidId: string;
  nameReadOnly: boolean;
  emailReadOnly: boolean;
  orcidReadOnly: boolean;
};

export type AuthorFieldProps = {
  schema: AuthorOption;
  value: Author[];
  onChange: (value: Author[]) => void;
  affiliationList?: Affiliation[];
  onAffiliationListChange?: (list: Affiliation[]) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
  initialOpenAuthorIndex?: number;
  initialOpenAffiliationIndex?: number;
  contactDetails?: ContactDetailsForAuthor;
};

export function AuthorField({
  schema,
  value = [],
  onChange,
  affiliationList: affiliationListProp = [],
  onAffiliationListChange,
  draftObjectId = null,
  onDraftCreated,
  initialOpenAuthorIndex,
  initialOpenAffiliationIndex,
  contactDetails,
}: AuthorFieldProps) {
  const [addAuthorSearchValue, setAddAuthorSearchValue] = useState('');
  const lastOrcidResultsRef = useRef<OrcidSearchHit[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeAuthorId, setActiveAuthorId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [openAffiliationId, setOpenAffiliationId] = useState<string | null>(null);
  const lastCardAffiliationInputRef = useRef<HTMLInputElement>(null);
  const authorCountRef = useRef(value.length);
  const valueRef = useRef(value);
  valueRef.current = value;
  const pendingOrcidRef = useRef<string | null>(null);
  const addMeOrcidAuthorIdRef = useRef<string | null>(null);
  const suggestionOrcidAuthorIdRef = useRef<string | null>(null);
  const lastSubmittedOrcidQRef = useRef('');
  const orcidFetcher = useFetcher();
  const orcidSearchFetcher = useFetcher();
  const affiliationList = affiliationListProp ?? [];

  useEffect(() => {
    const trimmed = addAuthorSearchValue.trim();
    if (!trimmed) return;
    const orcidId = extractOrcidId(trimmed);
    if (orcidId) {
      lastSubmittedOrcidQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-orcid-by-id');
      fd.set('orcid', orcidId);
      orcidSearchFetcher.submit(fd, { method: 'POST' });
      return;
    }
    const t = setTimeout(() => {
      lastSubmittedOrcidQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-orcid');
      fd.set('q', trimmed);
      orcidSearchFetcher.submit(fd, { method: 'POST' });
    }, 300);
    return () => clearTimeout(t);
  }, [addAuthorSearchValue]);

  const orcidSearchOptions = (() => {
    if (orcidSearchFetcher.state !== 'idle' || !orcidSearchFetcher.data) return undefined;
    const currentQ = addAuthorSearchValue.trim();
    if (currentQ !== lastSubmittedOrcidQRef.current) return undefined;
    const data = orcidSearchFetcher.data as { results?: OrcidSearchHit[] };
    const results = data?.results ?? [];
    lastOrcidResultsRef.current = results;
    return results.map((r) => ({
      value: r.orcid,
      label: r.name,
      description: r.firstAffiliation,
    }));
  })();
  const orcidSearchLoading = orcidSearchFetcher.state !== 'idle';

  const authorErrors = getAuthorFieldErrors(value);
  const isValid = value.length > 0 && authorErrors.length === 0;

  const [authorOrder, setAuthorOrder] = useState<string[]>(() => value.map((a) => a.id));

  useEffect(() => {
    setAuthorOrder(value.map((a) => a.id));
  }, [value]);

  const appendAuthor = (newAuthor: Author) => {
    const newAuthors = [...valueRef.current, newAuthor];
    handleChange(newAuthors);
    setAuthorOrder(newAuthors.map((a) => a.id));
  };

  const addMeAsAuthor = () => {
    if (!contactDetails) return;
    const newAuthor: Author = {
      id: uuid(),
      name: contactDetails.name || 'Author',
      email: contactDetails.email || undefined,
      orcid: contactDetails.orcidId || undefined,
      affiliationIds: [],
    };
    appendAuthor(newAuthor);
    if (
      contactDetails.orcidId &&
      isValidOrcid(contactDetails.orcidId) &&
      orcidFetcher.state === 'idle'
    ) {
      addMeOrcidAuthorIdRef.current = newAuthor.id;
      const fd = new FormData();
      fd.set('intent', 'fetch-orcid');
      fd.set('orcid', contactDetails.orcidId);
      orcidFetcher.submit(fd, { method: 'POST' });
    }
  };

  const initialExpandAppliedRef = useRef({ author: false, affiliation: false });
  useEffect(() => {
    if (
      initialExpandAppliedRef.current.author ||
      initialOpenAuthorIndex == null ||
      initialOpenAuthorIndex < 0 ||
      initialOpenAuthorIndex >= value.length
    )
      return;
    initialExpandAppliedRef.current.author = true;
    setOpenIndex(initialOpenAuthorIndex);
  }, [initialOpenAuthorIndex, value.length]);

  useEffect(() => {
    if (
      initialExpandAppliedRef.current.affiliation ||
      initialOpenAffiliationIndex == null ||
      initialOpenAffiliationIndex < 0 ||
      !affiliationList[initialOpenAffiliationIndex]
    )
      return;
    initialExpandAppliedRef.current.affiliation = true;
    setAdvancedOpen(true);
    setOpenAffiliationId(affiliationList[initialOpenAffiliationIndex].id);
  }, [initialOpenAffiliationIndex, affiliationList]);

  useEffect(() => {
    if (value.length > authorCountRef.current) {
      lastCardAffiliationInputRef.current?.focus();
    }
    authorCountRef.current = value.length;
  }, [value.length]);
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  const handleChange = (newAuthors: Author[]) => {
    onChange(newAuthors);
    save(newAuthors);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveAuthorId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAuthorId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = authorOrder.indexOf(active.id as string);
    const newIndex = authorOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = [...authorOrder];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    setAuthorOrder(newOrder);

    const newValue = newOrder
      .map((id) => value.find((a) => a.id === id))
      .filter((a): a is Author => a != null);
    handleChange(newValue);
    const oldValueIndex = value.findIndex((a) => a.id === moved);
    const newValueIndex = newValue.findIndex((a) => a.id === moved);
    if (openIndex === oldValueIndex) {
      setOpenIndex(newValueIndex);
    } else if (openIndex !== null) {
      if (oldValueIndex < openIndex && newValueIndex >= openIndex) {
        setOpenIndex(openIndex - 1);
      } else if (oldValueIndex > openIndex && newValueIndex <= openIndex) {
        setOpenIndex(openIndex + 1);
      }
    }
  };

  const handleMoveAuthorOrderItem = (itemId: string, direction: 'up' | 'down') => {
    const oldIndex = authorOrder.indexOf(itemId);
    if (oldIndex === -1) return;
    const newIndex = direction === 'up' ? oldIndex - 1 : oldIndex + 1;
    if (newIndex < 0 || newIndex >= authorOrder.length) return;
    const newOrder = [...authorOrder];
    [newOrder[oldIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[oldIndex]];
    setAuthorOrder(newOrder);

    const newValue = newOrder
      .map((id) => value.find((a) => a.id === id))
      .filter((a): a is Author => a != null);
    const prevIds = value.map((a) => a.id);
    const nextIds = newValue.map((a) => a.id);
    const sameAuthorOrder =
      prevIds.length === nextIds.length && prevIds.every((id, i) => id === nextIds[i]);
    if (!sameAuthorOrder) {
      handleChange(newValue);
      if (openIndex != null) {
        const openId = value[openIndex]?.id;
        const nextOpenIndex = openId ? newValue.findIndex((a) => a.id === openId) : -1;
        setOpenIndex(nextOpenIndex === -1 ? null : nextOpenIndex);
      }
    }
  };

  useEffect(() => {
    if (orcidFetcher.state !== 'idle' || !orcidFetcher.data) return;
    const data = orcidFetcher.data as {
      name?: string;
      orcid?: string;
      email?: string;
      affiliations?: {
        name: string;
        city?: string;
        region?: string;
        country?: string;
        ror?: string;
      }[];
      error?: { message?: string };
    };

    if (addMeOrcidAuthorIdRef.current) {
      const targetId = addMeOrcidAuthorIdRef.current;
      addMeOrcidAuthorIdRef.current = null;
      if (data?.error) return;
      const currentAuthors = valueRef.current;
      const idx = currentAuthors.findIndex((a) => a.id === targetId);
      if (idx === -1) return;
      const author = currentAuthors[idx];
      const nameFromOrcid =
        data?.name && data?.orcid ? String(data.name).trim() || undefined : undefined;
      const emailFromOrcid = data?.orcid && data?.email?.trim() ? data.email?.trim() : undefined;
      const affiliationsFromOrcid = Array.isArray(data?.affiliations) ? data.affiliations : [];
      let nextList = [...affiliationList];
      let listModified = false;
      const newAffiliationIds: string[] = [...(author.affiliationIds ?? [])];
      for (const aff of affiliationsFromOrcid) {
        const trimmed = String(aff?.name ?? '').trim();
        if (!trimmed) continue;
        const existingExact = nextList.find(
          (a) =>
            (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase() &&
            (a.city ?? '') === (aff?.city ?? '') &&
            (a.country ?? '') === (aff?.country ?? ''),
        );
        const existing =
          existingExact ||
          nextList.find((a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          if (!newAffiliationIds.includes(existing.id)) newAffiliationIds.push(existing.id);
          if (aff?.ror && !(existing.ror ?? '').trim()) {
            nextList = nextList.map((a) => (a.id === existing.id ? { ...a, ror: aff.ror } : a));
            listModified = true;
          }
        } else {
          const newAff: Affiliation = {
            id: uuid(),
            name: trimmed,
            ...(aff?.city && { city: aff.city }),
            ...(aff?.country && { country: aff.country }),
            ...(aff?.ror && { ror: aff.ror }),
          };
          nextList = [...nextList, newAff];
          newAffiliationIds.push(newAff.id);
          listModified = true;
        }
      }
      if (listModified) onAffiliationListChange?.(nextList);
      const updates: Partial<Author> = {};
      if (nameFromOrcid && (!(author.name ?? '').trim() || author.name === 'Author'))
        updates.name = nameFromOrcid;
      if (emailFromOrcid && !(author.email ?? '').trim()) updates.email = emailFromOrcid;
      if (newAffiliationIds.length > 0) updates.affiliationIds = newAffiliationIds;
      if (Object.keys(updates).length > 0) {
        const next = currentAuthors.map((a, i) => (i === idx ? { ...a, ...updates } : a));
        handleChange(next);
      }
      return;
    }

    if (suggestionOrcidAuthorIdRef.current) {
      const targetId = suggestionOrcidAuthorIdRef.current;
      suggestionOrcidAuthorIdRef.current = null;
      if (data?.error) return;
      const currentAuthors = valueRef.current;
      const idx = currentAuthors.findIndex((a) => a.id === targetId);
      if (idx === -1) return;
      const author = currentAuthors[idx];
      const nameFromOrcid =
        data?.name && data?.orcid ? String(data.name).trim() || undefined : undefined;
      const emailFromOrcid = data?.orcid && data?.email?.trim() ? data.email?.trim() : undefined;
      const affiliationsFromOrcid = Array.isArray(data?.affiliations) ? data.affiliations : [];
      let nextList = [...affiliationList];
      let listModified = false;
      const newAffiliationIds: string[] = [...(author.affiliationIds ?? [])];
      for (const aff of affiliationsFromOrcid) {
        const trimmed = String(aff?.name ?? '').trim();
        if (!trimmed) continue;
        const existingExact = nextList.find(
          (a) =>
            (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase() &&
            (a.city ?? '') === (aff?.city ?? '') &&
            (a.country ?? '') === (aff?.country ?? ''),
        );
        const existing =
          existingExact ||
          nextList.find((a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          if (!newAffiliationIds.includes(existing.id)) newAffiliationIds.push(existing.id);
          if (aff?.ror && !(existing.ror ?? '').trim()) {
            nextList = nextList.map((a) => (a.id === existing.id ? { ...a, ror: aff.ror } : a));
            listModified = true;
          }
        } else {
          const newAff: Affiliation = {
            id: uuid(),
            name: trimmed,
            ...(aff?.city && { city: aff.city }),
            ...(aff?.country && { country: aff.country }),
            ...(aff?.ror && { ror: aff.ror }),
          };
          nextList = [...nextList, newAff];
          newAffiliationIds.push(newAff.id);
          listModified = true;
        }
      }
      if (listModified) onAffiliationListChange?.(nextList);
      const updates: Partial<Author> = {};
      if (nameFromOrcid && (!(author.name ?? '').trim() || author.name === 'Author'))
        updates.name = nameFromOrcid;
      if (emailFromOrcid && !(author.email ?? '').trim()) updates.email = emailFromOrcid;
      if (newAffiliationIds.length > 0) updates.affiliationIds = newAffiliationIds;
      if (Object.keys(updates).length > 0) {
        const next = currentAuthors.map((a, i) => (i === idx ? { ...a, ...updates } : a));
        handleChange(next);
      }
      return;
    }

    if (!pendingOrcidRef.current) return;
    const orcid = pendingOrcidRef.current;
    pendingOrcidRef.current = null;
    const name =
      data?.error || !data?.name || !data?.orcid ? orcid : String(data.name).trim() || orcid;
    const email =
      data?.error || !data?.orcid ? undefined : (data.email?.trim() && data.email) || undefined;
    const affiliationsFromOrcid = Array.isArray(data?.affiliations) ? data.affiliations : [];
    let nextList = [...affiliationList];
    let listModified = false;
    const affiliationIds: string[] = [];
    for (const aff of affiliationsFromOrcid) {
      const trimmed = String(aff?.name ?? '').trim();
      if (!trimmed) continue;
      const existingExact = nextList.find(
        (a) =>
          (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase() &&
          (a.city ?? '') === (aff?.city ?? '') &&
          (a.country ?? '') === (aff?.country ?? ''),
      );
      const existing =
        existingExact ||
        nextList.find((a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        affiliationIds.push(existing.id);
        if (aff?.ror && !(existing.ror ?? '').trim()) {
          nextList = nextList.map((a) => (a.id === existing.id ? { ...a, ror: aff.ror } : a));
          listModified = true;
        }
      } else {
        const newAff: Affiliation = {
          id: uuid(),
          name: trimmed,
          ...(aff?.city && { city: aff.city }),
          ...(aff?.country && { country: aff.country }),
          ...(aff?.ror && { ror: aff.ror }),
        };
        nextList = [...nextList, newAff];
        affiliationIds.push(newAff.id);
        listModified = true;
      }
    }
    if (listModified) onAffiliationListChange?.(nextList);
    const newAuthor: Author = {
      id: uuid(),
      name,
      orcid: data?.orcid ?? orcid,
      ...(email && { email }),
      affiliationIds,
    };
    appendAuthor(newAuthor);
    setAddAuthorSearchValue('');
  }, [orcidFetcher.state, orcidFetcher.data, affiliationList, onAffiliationListChange]);

  const onSelectOrcidSuggestion = (hit: OrcidSearchHit) => {
    setAddAuthorSearchValue('');
    let affiliationIds: string[] = [];
    let nextList = [...affiliationList];
    if (hit.firstAffiliation?.trim()) {
      const trimmed = hit.firstAffiliation.trim();
      const existing = nextList.find(
        (a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        affiliationIds = [existing.id];
      } else {
        const newAff: Affiliation = { id: uuid(), name: trimmed };
        nextList = [...nextList, newAff];
        affiliationIds = [newAff.id];
      }
      if (nextList.length > affiliationList.length) onAffiliationListChange?.(nextList);
    }
    const newAuthor: Author = {
      id: uuid(),
      name: hit.name.trim() || hit.orcid,
      orcid: hit.orcid,
      ...(hit.email?.trim() && { email: hit.email.trim() }),
      affiliationIds,
    };
    appendAuthor(newAuthor);
    suggestionOrcidAuthorIdRef.current = newAuthor.id;
    const fd = new FormData();
    fd.set('intent', 'fetch-orcid');
    fd.set('orcid', hit.orcid);
    orcidFetcher.submit(fd, { method: 'POST' });
  };

  const onAuthorSelectFromCombobox = (orcid: string) => {
    const hit = lastOrcidResultsRef.current.find((r) => r.orcid === orcid);
    if (hit) {
      onSelectOrcidSuggestion(hit);
      setAddAuthorSearchValue('');
    }
  };

  const handleAddAuthor = () => {
    const trimmed = addAuthorSearchValue.trim();
    if (!trimmed) return;
    if (isValidOrcid(trimmed)) {
      pendingOrcidRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'fetch-orcid');
      fd.set('orcid', trimmed);
      orcidFetcher.submit(fd, { method: 'POST' });
      return;
    }
    const newAuthor: Author = {
      id: uuid(),
      name: trimmed,
      affiliationIds: [],
    };
    appendAuthor(newAuthor);
    setAddAuthorSearchValue('');
  };

  const handleEnsureAffiliationInList = (aff: Affiliation) => {
    if (affiliationList.some((a) => a.id === aff.id)) return;
    onAffiliationListChange?.([...affiliationList, aff]);
  };

  const handleRenameAffiliation = (affiliationId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newList = affiliationList.map((a) =>
      a.id === affiliationId ? { ...a, name: trimmed } : a,
    );
    onAffiliationListChange?.(newList);
  };

  const handleUpdateAffiliation = (affiliationId: string, updates: Partial<Affiliation>) => {
    const newList = affiliationList.map((a) => (a.id === affiliationId ? { ...a, ...updates } : a));
    onAffiliationListChange?.(newList);
  };

  const handleRemoveAffiliationFromList = (affiliationId: string) => {
    onAffiliationListChange?.(affiliationList.filter((a) => a.id !== affiliationId));
    const newAuthors = value.map((author) => ({
      ...author,
      affiliationIds: (author.affiliationIds ?? []).filter((id) => id !== affiliationId),
    }));
    handleChange(newAuthors);
  };

  const [addAffiliationInput, setAddAffiliationInput] = useState('');
  const lastAddAffiliationRorResultsRef = useRef<RorSearchHit[]>([]);
  const lastSubmittedAddAffiliationRorQRef = useRef('');
  const addAffiliationRorFetcher = useFetcher();

  useEffect(() => {
    const trimmed = addAffiliationInput.trim();
    if (!trimmed) return;
    const t = setTimeout(() => {
      lastSubmittedAddAffiliationRorQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-ror');
      fd.set('q', trimmed);
      addAffiliationRorFetcher.submit(fd, { method: 'POST' });
    }, 300);
    return () => clearTimeout(t);
  }, [addAffiliationInput]);

  const addAffiliationRorOptions = (() => {
    const hasRorResults =
      addAffiliationRorFetcher.state === 'idle' && addAffiliationRorFetcher.data;
    if (!hasRorResults) return undefined;
    const currentQ = addAffiliationInput.trim();
    if (currentQ !== lastSubmittedAddAffiliationRorQRef.current) return undefined;
    const data = addAffiliationRorFetcher.data as { results?: RorSearchHit[] };
    const results = data?.results ?? [];
    lastAddAffiliationRorResultsRef.current = results;
    return results.map((r) => ({
      value: r.ror,
      label: r.name,
      description: [r.city, r.country].filter(Boolean).join(', ') || undefined,
    }));
  })();
  const addAffiliationRorLoading = addAffiliationRorFetcher.state !== 'idle';

  const onSelectAddAffiliationRor = (hit: RorSearchHit) => {
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
    onAffiliationListChange?.([...affiliationList, aff]);
    setAddAffiliationInput('');
  };

  const onSelectAddAffiliationRorFromCombobox = (ror: string) => {
    const hit = lastAddAffiliationRorResultsRef.current.find((r) => r.ror === ror);
    if (hit) onSelectAddAffiliationRor(hit);
  };

  const handleAddAffiliationFromBox = () => {
    const trimmed = addAffiliationInput.trim();
    if (!trimmed) return;
    const aff: Affiliation = { id: uuid(), name: trimmed };
    onAffiliationListChange?.([...affiliationList, aff]);
    setAddAffiliationInput('');
  };

  const handleAuthorChange = (index: number, updatedAuthor: Author) => {
    const newAuthors = [...value];
    newAuthors[index] = updatedAuthor;
    handleChange(newAuthors);
  };

  const handleDelete = (index: number) => {
    const newAuthors = value.filter((_, i) => i !== index);
    handleChange(newAuthors);
    setAuthorOrder(newAuthors.map((a) => a.id));
    if (openIndex === index) {
      setOpenIndex(null);
    } else if (openIndex !== null && openIndex > index) {
      setOpenIndex(openIndex - 1);
    }
  };

  const activeAuthor = activeAuthorId ? value.find((a) => a.id === activeAuthorId) : null;
  const activeAuthorOverlay =
    activeAuthor && activeAuthorId ? (
      <div
        className="flex gap-3 items-center p-4 w-72 rounded-sm border shadow-lg border-border bg-background cursor-grabbing"
        style={{ minHeight: 56 }}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        <span
          className={`flex-1 min-w-0 truncate text-base font-semibold ${
            (activeAuthor.name ?? '').trim() ? '' : 'text-muted-foreground/60'
          }`}
        >
          {(activeAuthor.name ?? '').trim() || 'Author Name'}
        </span>
        {activeAuthor.orcid && isValidOrcid(activeAuthor.orcid) && (
          <a
            href={
              activeAuthor.orcid.startsWith('http')
                ? activeAuthor.orcid
                : `https://orcid.org/${activeAuthor.orcid}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline cursor-pointer shrink-0"
            aria-label="View ORCID profile"
            onClick={(e) => e.stopPropagation()}
          >
            <OrcidIcon className="w-4 h-4 text-[#A6CE39]" aria-hidden />
          </a>
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <ui.FormLabel
        htmlFor={schema.name}
        required={schema.required}
        valid={isValid}
        defined={value.length > 0}
      >
        {schema.title}
      </ui.FormLabel>

      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={authorOrder} strategy={verticalListSortingStrategy}>
            {authorOrder.map((id, orderIndex) => {
              const author = value.find((a) => a.id === id);
              if (!author) return null;
              const index = value.findIndex((a) => a.id === id);
              return (
                <AuthorCard
                  key={author.id}
                  value={author}
                  index={index}
                  open={openIndex === index}
                  onOpenChange={(open) => setOpenIndex(open ? index : null)}
                  onChange={(updatedAuthor) => handleAuthorChange(index, updatedAuthor)}
                  onDelete={() => handleDelete(index)}
                  affiliationList={affiliationList}
                  onEnsureAffiliationInList={handleEnsureAffiliationInList}
                  onRenameAffiliation={handleRenameAffiliation}
                  onUpdateAffiliation={handleUpdateAffiliation}
                  affiliationInputRef={
                    index === value.length - 1 ? lastCardAffiliationInputRef : undefined
                  }
                  onMoveUp={() => handleMoveAuthorOrderItem(author.id, 'up')}
                  onMoveDown={() => handleMoveAuthorOrderItem(author.id, 'down')}
                  canMoveUp={orderIndex > 0}
                  canMoveDown={orderIndex < authorOrder.length - 1}
                />
              );
            })}
          </SortableContext>
          <AddAuthorPlaceholderCard
            orcidSearchExternalOptions={orcidSearchOptions ?? []}
            orcidSearchLoading={orcidSearchLoading}
            onAuthorSelect={onAuthorSelectFromCombobox}
            onSearchChange={setAddAuthorSearchValue}
            addAuthorSearchValue={addAuthorSearchValue}
            handleAddAuthor={handleAddAuthor}
            orcidFetcher={orcidFetcher}
            addMeAsAuthor={addMeAsAuthor}
            showAddMeAsAuthor={Boolean(
              contactDetails &&
              !value.some(
                (a) =>
                  normalizeOrcidForCompare(a.orcid) ===
                  normalizeOrcidForCompare(contactDetails?.orcidId),
              ),
            )}
            isEmpty={value.length === 0}
          />
          <DragOverlay dropAnimation={null}>{activeAuthorOverlay}</DragOverlay>
        </DndContext>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex gap-2 items-center p-0 text-sm bg-transparent border-0 cursor-pointer text-muted-foreground hover:text-foreground"
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? (
            <Minus className="w-4 h-4 shrink-0" aria-hidden />
          ) : (
            <Plus className="w-4 h-4 shrink-0" aria-hidden />
          )}
          <span>Advanced options</span>
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 justify-between items-center">
              <p className="text-sm font-medium text-foreground">Affiliations</p>
              {(() => {
                const usedAffiliationIds = new Set(value.flatMap((a) => a.affiliationIds ?? []));
                const unusedCount = affiliationList.filter(
                  (aff) => !usedAffiliationIds.has(aff.id),
                ).length;
                return (
                  <ui.Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={unusedCount === 0}
                    onClick={() => {
                      const used = new Set(value.flatMap((a) => a.affiliationIds ?? []));
                      onAffiliationListChange?.(affiliationList.filter((aff) => used.has(aff.id)));
                    }}
                    className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Delete unused affiliations
                  </ui.Button>
                );
              })()}
            </div>
            {affiliationList.length > 0 ? (
              <ul className="space-y-2">
                {affiliationList.map((aff) => {
                  const authorCount = value.filter((a) =>
                    (a.affiliationIds ?? []).includes(aff.id),
                  ).length;
                  return (
                    <AffiliationListItem
                      key={aff.id}
                      affiliation={aff}
                      authorCount={authorCount}
                      open={openAffiliationId === aff.id}
                      onOpenChange={(open) => setOpenAffiliationId(open ? aff.id : null)}
                      onUpdate={(updates) => handleUpdateAffiliation(aff.id, updates)}
                      onRemove={() => handleRemoveAffiliationFromList(aff.id)}
                    />
                  );
                })}
              </ul>
            ) : null}
            <div className="flex gap-2 items-center p-4 rounded-sm border border-dashed border-border bg-background">
              <div className="relative flex-1 min-w-0">
                <ui.AsyncComboBox
                  triggerMode="inline"
                  value=""
                  searchValue={addAffiliationInput}
                  onValueChange={onSelectAddAffiliationRorFromCombobox}
                  onSearch={async () => []}
                  onSearchChange={setAddAffiliationInput}
                  externalOptions={addAffiliationRorOptions ?? []}
                  externalLoading={addAffiliationRorLoading}
                  placeholder="Affiliation name (search ROR)"
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
                onClick={handleAddAffiliationFromBox}
                disabled={!addAffiliationInput.trim()}
                className="cursor-pointer shrink-0"
              >
                <>
                  Add Affiliation
                  <CornerDownLeft className="w-4 h-4 shrink-0" aria-hidden />
                </>
              </ui.Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
