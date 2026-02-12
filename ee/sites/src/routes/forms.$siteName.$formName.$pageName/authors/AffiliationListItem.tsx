import { useState, useEffect } from 'react';
import { Building2, Pencil, Trash2, ChevronUp } from 'lucide-react';
import { RorIcon } from '@scienceicons/react/24/solid';
import type { Affiliation } from '../types.js';
import { ui } from '@curvenote/scms-core';

export type AffiliationListItemProps = {
  affiliation: Affiliation;
  authorCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<Affiliation>) => void;
  onRemove: () => void;
};

export function AffiliationListItem({
  affiliation,
  authorCount,
  open,
  onOpenChange,
  onUpdate,
  onRemove,
}: AffiliationListItemProps) {
  const [editName, setEditName] = useState(affiliation.name ?? '');
  const [editDepartment, setEditDepartment] = useState(affiliation.department ?? '');
  const [editCity, setEditCity] = useState(affiliation.city ?? '');
  const [editCountry, setEditCountry] = useState(affiliation.country ?? '');

  useEffect(() => {
    setEditName(affiliation.name ?? '');
    setEditDepartment(affiliation.department ?? '');
    setEditCity(affiliation.city ?? '');
    setEditCountry(affiliation.country ?? '');
  }, [affiliation]);

  const saveName = () => {
    const trimmed = (editName ?? '').trim();
    const current = (affiliation.name ?? '').trim();
    if (trimmed !== current) onUpdate({ name: trimmed || undefined });
  };
  const saveDepartment = () => {
    const trimmed = (editDepartment ?? '').trim();
    if (trimmed !== (affiliation.department ?? '').trim()) {
      onUpdate({ department: trimmed || undefined });
    }
  };
  const saveCity = () => {
    const trimmed = (editCity ?? '').trim();
    if (trimmed !== (affiliation.city ?? '').trim()) onUpdate({ city: trimmed || undefined });
  };
  const saveCountry = () => {
    const trimmed = (editCountry ?? '').trim();
    if (trimmed !== (affiliation.country ?? '').trim()) onUpdate({ country: trimmed || undefined });
  };

  const nameDisplay = (editName ?? '').trim();
  const nameValid = nameDisplay.length > 0;
  const deptDisplay = (editDepartment ?? '').trim();
  const cityDisplay = (editCity ?? '').trim();
  const countryDisplay = (editCountry ?? '').trim();
  const rorFields = affiliation.rorFields ?? [];
  const nameFromRor = rorFields.includes('name');
  const cityFromRor = rorFields.includes('city');
  const countryFromRor = rorFields.includes('country');

  return (
    <li className="flex gap-2 items-start p-4 rounded-sm border border-border bg-background">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-1 gap-1 items-center min-w-0">
            <span
              className={`text-base font-semibold min-w-0 truncate ${
                !nameValid ? 'text-muted-foreground/60' : ''
              }`}
            >
              {nameDisplay || 'Affiliation name'}
            </span>
            {(affiliation.ror ?? '').trim() && (
              <a
                href={affiliation.ror!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex no-underline cursor-pointer shrink-0"
                title={affiliation.ror}
                aria-label="View ROR profile"
              >
                <RorIcon className="h-4 w-[22px] shrink-0 text-muted-foreground" />
              </a>
            )}
          </div>
          <span className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground bg-muted/70 shrink-0">
            {authorCount === 1 ? '1 author' : `${authorCount} authors`}
          </span>
          {(deptDisplay || cityDisplay || countryDisplay) && (
            <span className="text-sm truncate text-muted-foreground">
              {[deptDisplay, cityDisplay, countryDisplay].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {open ? (
          <>
            <hr className="mb-4 border-border" />
            <div className="space-y-4">
              <div className="space-y-2">
                <ui.FormLabel
                  htmlFor={`aff-${affiliation.id}-name`}
                  required
                  valid={nameValid}
                  invalid={!nameValid}
                >
                  Name
                </ui.FormLabel>
                <ui.Input
                  id={`aff-${affiliation.id}-name`}
                  type="text"
                  autoComplete="off"
                  value={editName ?? ''}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={saveName}
                  placeholder="Affiliation name"
                  disabled={nameFromRor}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`aff-${affiliation.id}-department`} className="text-sm font-medium">
                  Department
                </label>
                <ui.Input
                  id={`aff-${affiliation.id}-department`}
                  type="text"
                  autoComplete="off"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  onBlur={saveDepartment}
                  placeholder="Department"
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <label htmlFor={`aff-${affiliation.id}-city`} className="text-sm font-medium">
                    City
                  </label>
                  <ui.Input
                    id={`aff-${affiliation.id}-city`}
                    type="text"
                    autoComplete="off"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    onBlur={saveCity}
                    placeholder="City"
                    disabled={cityFromRor}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label htmlFor={`aff-${affiliation.id}-country`} className="text-sm font-medium">
                    Country
                  </label>
                  <ui.Input
                    id={`aff-${affiliation.id}-country`}
                    type="text"
                    autoComplete="off"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    onBlur={saveCountry}
                    placeholder="Country"
                    disabled={countryFromRor}
                    className="w-full"
                  />
                </div>
              </div>
              {(affiliation.ror ?? '').trim() && (
                <p className="pt-1 font-mono text-sm truncate text-muted-foreground">
                  ROR:{' '}
                  <a
                    href={affiliation.ror!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline cursor-pointer text-muted-foreground hover:text-muted-foreground"
                  >
                    {affiliation.ror}
                  </a>
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex gap-1 items-start shrink-0">
        <ui.Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onOpenChange(!open)}
          aria-label={open ? 'Collapse' : 'Edit affiliation'}
          className="cursor-pointer"
        >
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Pencil className="w-4 h-4 text-muted-foreground" />
          )}
        </ui.Button>
        <ui.Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          disabled={authorCount >= 1}
          aria-label={
            authorCount >= 1 ? 'Remove affiliation (in use by authors)' : 'Remove affiliation'
          }
          className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </ui.Button>
      </div>
    </li>
  );
}
