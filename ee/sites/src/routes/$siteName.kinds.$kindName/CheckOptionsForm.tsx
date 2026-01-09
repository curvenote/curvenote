import { CheckOptionNumber } from './CheckOptionNumber.js';
import { CheckOptionBoolean } from './CheckOptionBoolean.js';
import { CheckOptionString } from './CheckOptionString.js';

export type CheckOptionsFormProps = {
  check: any;
};

export function CheckOptionsForm({ check }: CheckOptionsFormProps) {
  if (!check.options || check.options.length === 0) return null;
  // Sort min/max together, min before max
  const sorted = [...check.options].sort((a, b) => {
    if ((a.id === 'min' && b.id === 'max') || (a.id === 'max' && b.id === 'min')) {
      return a.id === 'min' ? -1 : 1;
    }
    return 0;
  });
  return (
    <div className="flex flex-col w-full gap-6 px-6 mb-4">
      {sorted.map((opt) => {
        if (opt.type === 'number') {
          return <CheckOptionNumber key={opt.id} option={opt} check={check} />;
        }
        if (opt.type === 'boolean') {
          return <CheckOptionBoolean key={opt.id} option={opt} check={check} />;
        }
        if (opt.type === 'string') {
          return <CheckOptionString key={opt.id} option={opt} check={check} />;
        }
        return null;
      })}
    </div>
  );
}
