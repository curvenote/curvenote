import { GitBranch } from 'lucide-react';

export type TagVariant = 'default' | 'latest' | 'previous';

const variantClassName: Record<TagVariant, string> = {
  default: 'text-white bg-black dark:text-black dark:bg-white',
  latest: 'text-white bg-green-600 dark:text-white dark:bg-green-600',
  previous: 'text-white bg-gray-500 dark:text-white dark:bg-gray-500',
};

export function Tag({ tag, variant = 'default' }: { tag: string; variant?: TagVariant }) {
  return (
    <div
      className={`flex gap-1 items-center px-[6px] py-1 text-xs rounded-xs ${variantClassName[variant]}`}
    >
      <GitBranch className="w-3 h-3" />
      {tag}
    </div>
  );
}
