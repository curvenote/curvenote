import { Search, X } from 'lucide-react';
import { ui } from '@curvenote/scms-core';

interface AnalyticsEventSearchProps {
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
  placeholder?: string;
  className?: string;
}

export function AnalyticsEventSearch({
  searchTerm,
  onSearchChange,
  placeholder = 'Search events by name or description...',
  className = '',
}: AnalyticsEventSearchProps) {
  const handleClear = () => {
    onSearchChange('');
  };

  return (
    <div className={`relative mb-4 ${className}`}>
      <div className="relative">
        <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
        <ui.Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <ui.Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute w-8 h-8 p-0 transform -translate-y-1/2 right-1 top-1/2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Clear search</span>
          </ui.Button>
        )}
      </div>
    </div>
  );
}
