/**
 * GroupedItems - Utility Component for Consistent Group Rendering
 *
 * This component provides a standardized way to render grouped lists with consistent
 * styling and behavior. It's designed to be used within renderGroup functions to
 * maintain design consistency across the application.
 *
 * ## What This Component Does
 *
 * - Provides consistent group container styling
 * - Handles individual item containers with proper borders and spacing
 * - Manages global vs local index calculation for items
 * - Supports flexible group headers (custom content or default styling)
 * - Maintains the same item styling as the flat ClientFilterableList
 * - Handles empty groups gracefully
 *
 * ## When to Use This Component
 *
 * Use GroupedItems when you need:
 * - **Consistent styling** across different grouped lists
 * - **Standard item containers** that match the flat list styling
 * - **Easy group header management** with optional custom content
 * - **Proper index handling** for both global and local item positioning
 * - **Reusable group patterns** across different data types
 *
 * ## Core Features
 *
 * 1. **Group Container**: Provides consistent spacing and layout for groups
 * 2. **Item Containers**: Maintains the same border/padding styling as flat lists
 * 3. **Index Management**: Calculates both global and local indexes automatically
 * 4. **Header Flexibility**: Supports custom headers or default text styling
 * 5. **Empty State**: Handles empty groups gracefully
 * 6. **Accessibility**: Maintains proper semantic structure for screen readers
 *
 * ## Usage Examples
 *
 * ### Basic Usage with Default Header
 * ```typescript
 * const renderYearGroup = (groupKey: string, groupItems: Publication[], renderItem: Function) => (
 *   <GroupedItems
 *     groupKey={groupKey}
 *     groupItems={groupItems}
 *     globalStartIndex={0}
 *     renderItem={renderItem}
 *   />
 * );
 * ```
 *
 * ### Custom Header with Additional Styling
 * ```typescript
 * const renderStatusGroup = (groupKey: string, groupItems: Item[], renderItem: Function) => (
 *   <GroupedItems
 *     groupKey={groupKey}
 *     groupItems={groupItems}
 *     globalStartIndex={0}
 *     renderItem={renderItem}
 *     headerContent={(key, count, items) => (
 *       <div className="flex items-center gap-2 px-6 py-3">
 *         <StatusIcon status={key} />
 *         <h3 className="text-lg font-semibold">{key}</h3>
 *         <span className="text-sm text-gray-500">({count})</span>
 *       </div>
 *     )}
 *   />
 * );
 * ```
 *
 * ### No Header (Items Only)
 * ```typescript
 * const renderSimpleGroup = (groupKey: string, groupItems: Item[], renderItem: Function) => (
 *   <GroupedItems
 *     groupKey={groupKey}
 *     groupItems={groupItems}
 *     globalStartIndex={0}
 *     renderItem={renderItem}
 *     showHeader={false}
 *   />
 * );
 * ```
 *
 * ## Props Reference
 *
 * - `groupKey`: The key/name of the group (used for default header and React key)
 * - `groupItems`: Array of items in this group
 * - `globalStartIndex`: Starting index for global item numbering
 * - `renderItem`: Function to render individual items (receives item, globalIndex, localIndex)
 * - `headerContent`: Optional custom header content (overrides default)
 * - `showHeader`: Whether to show the group header (default: true)
 * - `className`: Additional CSS classes for the group container
 * - `itemClassName`: Additional CSS classes for individual item containers
 *
 * ## Index Calculation
 *
 * The component automatically calculates:
 * - **Global Index**: Position of item across all groups
 * - **Local Index**: Position of item within the current group
 *
 * Both indexes are passed to the renderItem function for flexibility.
 *
 * ## Styling Consistency
 *
 * Item containers use the same styling as ClientFilterableList:
 * - `border-b border-gray-200 dark:border-gray-700`
 * - `p-6 gap-2 md:gap-6`
 * - `flex flex-col md:flex-row md:items-center`
 * - `last:border-b-0` to remove border from last item
 */

import React from 'react';
import { cn } from '../../../../utils/index.js';

export interface GroupedItemsProps<T> {
  /** The key/name of the group */
  groupKey: string;

  /** Array of items in this group */
  groupItems: T[];

  /** Starting index for global item numbering across all groups */
  globalStartIndex: number;

  /** Function to render individual items */
  renderItem: (item: T, globalIndex: number, localIndex: number) => React.ReactNode;

  /** Optional custom header content (overrides default header) */
  headerContent?: (groupKey: string, itemCount: number, items: T[]) => React.ReactNode;

  /** Whether to show the group header (default: true) */
  showHeader?: boolean;

  /** Additional CSS classes for the group container */
  className?: string;

  /** Additional CSS classes for the group header */
  headerClassName?: string;

  /** Additional CSS classes for the group header text */
  headingTextClassName?: string;

  /** Additional CSS classes for individual item containers */
  itemClassName?: string;

  /** Function to generate unique keys for items */
  getItemKey?: (item: T, globalIndex: number, localIndex: number) => string | number;
}

/**
 * GroupedItems Component
 *
 * Renders a group of items with consistent styling and proper index management.
 * Designed to be used within renderGroup functions for ClientFilterableList.
 */
export function GroupedItems<T>({
  groupKey,
  groupItems,
  globalStartIndex,
  renderItem,
  headerContent,
  showHeader = true,
  className = '',
  headerClassName = '',
  headingTextClassName = '',
  itemClassName = '',
  getItemKey,
}: GroupedItemsProps<T>) {
  // Handle empty groups
  if (groupItems.length === 0) {
    return null;
  }

  const defaultHeaderContent = (
    <div
      className={cn(
        'px-6 pt-3 pb-1 border-b border-gray-200 dark:border-gray-700',
        headerClassName,
      )}
    >
      <h3
        className={cn('font-medium text-gray-700 text-md dark:text-gray-300', headingTextClassName)}
      >
        {groupKey}
      </h3>
    </div>
  );

  const defaultItemContainerClass = [
    'w-full',
    'border-b border-gray-200 dark:border-gray-700',
    'last:border-b-0',
    itemClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`group-container ${className}`}>
      {/* Group Header */}
      {showHeader &&
        (headerContent?.(groupKey, groupItems.length, groupItems) || defaultHeaderContent)}

      {/* Group Items */}
      <div className="group-items">
        {groupItems.map((item, localIndex) => {
          const globalIndex = globalStartIndex + localIndex;
          const itemKey = getItemKey
            ? getItemKey(item, globalIndex, localIndex)
            : `${groupKey}-${localIndex}`;

          return (
            <div key={itemKey} className={defaultItemContainerClass}>
              {renderItem(item, globalIndex, localIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * GroupHeader - Utility component for consistent group headers
 *
 * Provides a standard group header with optional count and custom styling.
 */
export interface GroupHeaderProps {
  /** The group title/name */
  title: string;

  /** Optional count to display */
  count?: number;

  /** Optional icon component */
  icon?: React.ReactNode;

  /** Additional content to display in the header */
  children?: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}

export function GroupHeader({ title, count, icon, children, className = '' }: GroupHeaderProps) {
  return (
    <div className={`px-6 py-3 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-500 dark:text-gray-400">{icon}</span>}
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        {count !== undefined && (
          <span className="text-sm text-gray-500 dark:text-gray-400">({count})</span>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Helper function to calculate global start index for a group
 *
 * @param groupedData Array of [groupKey, groupItems] tuples (output from grouping logic)
 * @param currentGroupIndex Index of the current group
 * @returns Global start index for the current group
 */
export function calculateGlobalStartIndex<T>(
  groupedData: [string, T[]][],
  currentGroupIndex: number,
): number {
  let globalIndex = 0;

  for (let i = 0; i < currentGroupIndex; i++) {
    globalIndex += groupedData[i][1].length;
  }

  return globalIndex;
}
