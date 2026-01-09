/**
 * A styled span for something like a slug
 */
export function SlugLike({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-1 font-mono text-xs text-black bg-gray-300 rounded">
      {children}
    </span>
  );
}
