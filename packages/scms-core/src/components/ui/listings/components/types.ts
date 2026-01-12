export interface FilterDefinition {
  key: string;
  value: boolean | string;
  label: string;
  count?: number;
  groupKey?: string; // Optional: group filters for mutual exclusivity
  default?: boolean; // Optional: set filter as active by default
}
