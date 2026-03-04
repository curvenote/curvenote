import { GitBranch } from 'lucide-react';

export function Tag({ tag }: { tag: string }) {
  return (
    <div className="flex gap-1 items-center px-[6px] py-1 text-xs text-white bg-black dark:text-black dark:bg-white rounded-xs">
      <GitBranch className="w-3 h-3" />
      {tag}
    </div>
  );
}
