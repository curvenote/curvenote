import { CurvenoteText } from '@curvenote/icons';

/** "Powered by Curvenote" link for forms sidebar (reuses same content as main app status bar). */
export function PoweredByCurvenote() {
  return (
    <div className="text-sm text-muted-foreground">
      <a
        className="flex gap-1.5 items-center cursor-pointer hover:text-foreground transition-colors"
        href="https://curvenote.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        Powered by <CurvenoteText className="inline-flex" size={18} />
      </a>
    </div>
  );
}
