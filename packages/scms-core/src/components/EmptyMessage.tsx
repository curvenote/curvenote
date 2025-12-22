/**
 * in-lieu of empty a prettier empty state
 *
 * @param param0
 * @returns
 */
export function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center text-xl min-h-[160px] font-semibold text-gray-500">
      {message}
    </div>
  );
}
