import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../../../utils/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface ClientQuerySearchProps<T> {
  searchTerm: string;
  filteredCount?: number;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  resultLabel?: string;
  className?: string;
}

export function ClientQuerySearch<T>({
  searchTerm,
  filteredCount,
  onSearchChange,
  placeholder = 'Search...',
  resultLabel = 'item',
  className = '',
}: ClientQuerySearchProps<T>) {
  const [searchInput, setSearchInput] = useState(searchTerm);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    onSearchChange(value);
  };

  const clearSearch = () => {
    setSearchInput('');
    onSearchChange('');
  };

  return (
    <div className={cn('mb-6', className)}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={searchInput}
          onChange={handleSearchChange}
          className="block w-full py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        {searchInput && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      {searchTerm && filteredCount !== undefined && (
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing results for "{searchTerm}" • {filteredCount} {resultLabel}
            {filteredCount !== 1 ? 's' : ''} found
          </div>
        </div>
      )}
    </div>
  );
}
