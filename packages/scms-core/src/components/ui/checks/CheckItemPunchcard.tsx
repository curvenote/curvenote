import { cn } from '../../../utils/cn.js';

export interface CheckItemPunchcardProps {
  stats: CheckItemPunchardStats[];
  /**
   * Size of each square (Tailwind size class number)
   * @default 5 (w-5 h-5 = 20px)
   */
  size?: number;
}

interface CheckItemPunchardStats {
  className: string;
  count: number;
  altText: string;
}

// Size class mapping for Tailwind CSS (needed for proper purging/JIT)
const SIZE_CLASSES: Record<number, string> = {
  2: 'w-2 h-2',
  3: 'w-3 h-3',
  4: 'w-4 h-4',
  5: 'w-5 h-5',
  6: 'w-6 h-6',
  8: 'w-8 h-8',
  10: 'w-10 h-10',
  12: 'w-12 h-12',
};

export function CheckItemPunchcard({ stats, size = 5 }: CheckItemPunchcardProps) {
  const colors: { className: string; altText: string }[] = [];

  for (const stat of stats) {
    for (let i = 0; i < stat.count; i++) {
      colors.push({ className: stat.className, altText: stat.altText });
    }
  }

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES[5];

  return (
    <div className="flex flex-wrap gap-[2px]">
      {colors.map(({ className, altText }, index) => (
        <div key={index} className={cn(sizeClass, className)} aria-hidden="true" title={altText} />
      ))}
    </div>
  );
}
