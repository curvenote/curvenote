import type { ReactNode } from 'react';
import { cn, ui } from '@curvenote/scms-core';

/** Nested tiles inside inbox sections (stat rows, activity rows). */
export const inboxTileClass = cn(
  'overflow-hidden rounded-sm border border-border bg-card text-left',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-border/80 hover:shadow-sm',
);

interface InboxSectionCardProps {
  title: ReactNode;
  description?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function InboxSectionCard({
  title,
  description,
  headerActions,
  children,
}: InboxSectionCardProps) {
  return (
    <ui.Card>
      <ui.CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <ui.CardTitle className="text-lg">{title}</ui.CardTitle>
          {description ? <ui.CardDescription>{description}</ui.CardDescription> : null}
        </div>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </ui.CardHeader>
      <ui.CardContent className="space-y-4">{children}</ui.CardContent>
    </ui.Card>
  );
}

interface InboxExpandLinkProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function InboxExpandLink({ children, onClick, disabled }: InboxExpandLinkProps) {
  return (
    <div className="flex justify-center">
      <ui.Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0"
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </ui.Button>
    </div>
  );
}
