import { CurvenoteText } from '@curvenote/icons';

export function PoweredByCurvenoteText({ message }: { message?: string }) {
  return (
    <div className="text-sm text-gray-500">
      <a
        className="flex gap-2 cursor-pointer"
        href="https://curvenote.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        {message ?? 'Powered by'} <CurvenoteText className="inline-flex" size={18} />
      </a>
    </div>
  );
}
