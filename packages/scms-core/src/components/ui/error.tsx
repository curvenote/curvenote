export function SmallErrorTray({ error }: { error: string }) {
  return (
    <div className="px-3 py-1 text-xs text-red-700 bg-red-100 rounded-sm dark:bg-red-900/30 dark:text-red-400">
      {error}
    </div>
  );
}
