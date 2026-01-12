import { ui } from '@curvenote/scms-core';

export interface WorksClientSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
}

export function WorksClientSearch({
  searchTerm,
  onSearchChange,
  placeholder = 'Search by title, authors, or DOI...',
}: WorksClientSearchProps) {
  return (
    <ui.ClientQuerySearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder={placeholder}
      resultLabel="work"
    />
  );
}
