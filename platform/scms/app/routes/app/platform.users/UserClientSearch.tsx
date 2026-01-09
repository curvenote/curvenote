import { Search, X } from 'lucide-react';
import { ui } from '@curvenote/scms-core';

interface UserClientSearchProps {
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
  placeholder?: string;
  className?: string;
}

export function UserClientSearch({
  searchTerm,
  onSearchChange,
  placeholder = 'Search users by name, email, username, or provider...',
  className = '',
}: UserClientSearchProps) {
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
