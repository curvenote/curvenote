import { Search } from 'lucide-react';
import { ui } from '@curvenote/scms-core';

interface SystemUserClientSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function SystemUserClientSearch({
  searchTerm,
  onSearchChange,
}: SystemUserClientSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute w-4 h-4 text-gray-400 top-3 left-3" />
      <ui.Input
        type="text"
        placeholder="Search users by name, email, or username..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}
