import { cn } from '../../../utils/cn.js';

export interface CheckItemPunchcardProps {
  /** Total number of units (squares) to render. */
  total: number;
  /** Count shown as red squares. */
  red: number;
  /** Count shown as amber squares. */
  amber: number;
  /** Count shown as green squares. */
  green: number;
  /**
   * Size of each square (Tailwind size class number)
   * @default 5 (w-5 h-5 = 20px)
   */
  size?: number;
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

export function CheckItemPunchcard({
  total,
  red,
  amber,
  green,
  size = 5,
}: CheckItemPunchcardProps) {
  const colors: string[] = [];

  for (let i = 0; i < red; i++) {
    colors.push('bg-[#9B1E1E]');
  }

  for (let i = 0; i < amber; i++) {
    colors.push('bg-yellow-600');
  }

  for (let i = 0; i < green; i++) {
    colors.push('bg-[#1B8364]');
  }

  const remaining = total - colors.length;
  for (let i = 0; i < remaining; i++) {
    colors.push('bg-blue-600');
  }

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES[5];

  return (
    <div className="flex flex-wrap gap-[2px]">
      {colors.map((colorClass, index) => (
        <div key={index} className={cn(sizeClass, colorClass)} aria-hidden="true" />
      ))}
    </div>
  );
}
