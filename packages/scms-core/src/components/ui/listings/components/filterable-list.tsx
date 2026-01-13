import React from 'react';

class ListErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error but don't crash the app
    console.warn('FilterableList DOM error caught:', error.message);
  }

  render() {
    if (this.state.hasError) {
      // Reset error state and try to render again
      setTimeout(() => this.setState({ hasError: false }), 0);
      return null; // Briefly render nothing to reset DOM state
    }

    return this.props.children;
  }
}

export interface FilterableListProps<T> {
  searchComponent?: React.ReactNode;
  filterBar?: React.ReactNode;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  error?: string;
  emptyMessage?: string;
  className?: string;
}

export function FilterableList<T>({
  searchComponent,
  filterBar,
  items,
  renderItem,
  getItemKey,
  error,
  emptyMessage = 'No items found.',
  className = '',
}: FilterableListProps<T>) {
  return (
    <ListErrorBoundary>
      <div className={`container mx-auto max-w-6xl ${className}`}>
        {error && (
          <div className="p-4 mb-6 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20">
            <div className="text-red-700 dark:text-red-400">
              <h3 className="mb-2 font-semibold">Error</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Search Component */}
        {searchComponent}

        {/* List Container */}
        <div className="overflow-hidden bg-white rounded-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          {/* Filter Bar */}
          {filterBar}

          {/* Items */}
          {items.map((item, index) => (
            <div
              key={getItemKey ? getItemKey(item, index) : `item-${index}`}
              className="flex flex-col gap-2 p-6 border-b border-gray-200 md:items-center md:flex-row md:gap-6 dark:border-gray-700 last:border-b-0"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>

        {items.length === 0 && !error && (
          <div className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          </div>
        )}
      </div>
    </ListErrorBoundary>
  );
}
