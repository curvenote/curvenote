import { useState } from 'react';
import { GripVertical } from 'lucide-react';
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
import type { Affiliation } from '../types.js';
import { getAffiliationName, getAffiliationSubtitle } from './affiliationHelpers.js';
import { SortableAffiliationRow } from './SortableAffiliationRow.js';

export type AffiliationSortableListProps = {
  affiliationIds: string[];
  affiliationList: Affiliation[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (affiliationId: string) => void;
  onRename: (affiliationId: string, newName: string) => void;
  onUpdate: (affiliationId: string, updates: Partial<Affiliation>) => void;
  authorId: string;
};

export function AffiliationSortableList({
  affiliationIds,
  affiliationList,
  onReorder,
  onRemove,
  onRename,
  onUpdate,
  authorId,
}: AffiliationSortableListProps) {
  const [activeAffId, setActiveAffId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveAffId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAffId(null);
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const oldIndex = affiliationIds.indexOf(activeId);
    const newIndex = affiliationIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = [...affiliationIds];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);
    onReorder(newOrder);
  };

  if (affiliationIds.length === 0) return null;

  const moveAffiliation = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= affiliationIds.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = [...affiliationIds];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    onReorder(newOrder);
  };

  const activeAffiliation = activeAffId ? affiliationList.find((a) => a.id === activeAffId) : null;
  const activeSubtitle = activeAffiliation ? getAffiliationSubtitle(activeAffiliation) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={affiliationIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {affiliationIds.map((affId, idx) => {
            const affiliation = affiliationList.find((a) => a.id === affId);
            if (!affiliation) return null;
            return (
              <SortableAffiliationRow
                key={`${authorId}-aff-${affId}`}
                authorId={authorId}
                affiliationId={affId}
                affiliation={affiliation}
                name={getAffiliationName(affiliationList, affId)}
                onRename={onRename}
                onUpdate={onUpdate}
                onRemove={() => onRemove(affId)}
                onMoveUp={() => moveAffiliation(idx, 'up')}
                onMoveDown={() => moveAffiliation(idx, 'down')}
                canMoveUp={idx > 0}
                canMoveDown={idx < affiliationIds.length - 1}
              />
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeAffiliation ? (
          <div
            className="flex gap-2 items-center px-3 py-2 w-64 text-sm rounded-md border shadow-lg border-border bg-muted/30 cursor-grabbing"
            style={{ minHeight: 40 }}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            <div className="flex-1 min-w-0 truncate">
              <span className="block truncate">
                {(activeAffiliation.name ?? '').trim() || 'Affiliation'}
              </span>
              {activeSubtitle ? (
                <span className="block text-xs truncate text-muted-foreground">
                  {activeSubtitle}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
