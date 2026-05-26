import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { cn, ui } from '@curvenote/scms-core';

export const SUBMISSIONS_PER_PAGE_OPTIONS = [15, 30, 50, 100] as const;
export const DEFAULT_SUBMISSIONS_PER_PAGE = 15;

interface SubmissionsPaginationProps {
  page: number;
  perPage: number;
  total: number;
  className?: string;
}

function pageHref(page: number, perPage: number) {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set('page', page.toString());
  }
  if (perPage !== DEFAULT_SUBMISSIONS_PER_PAGE) {
    params.set('perPage', perPage.toString());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function pageForPerPageChange(
  currentPage: number,
  currentPerPage: number,
  newPerPage: number,
  total: number,
): number {
  const currentTotalPages = Math.max(1, Math.ceil(total / currentPerPage));
  const safeCurrentPage = Math.min(currentPage, currentTotalPages);
  const firstItemIndex = (safeCurrentPage - 1) * currentPerPage;
  const newTotalPages = Math.max(1, Math.ceil(total / newPerPage));
  const newPage = Math.floor(firstItemIndex / newPerPage) + 1;
  return Math.min(Math.max(1, newPage), newTotalPages);
}

function buildPageItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | 'ellipsis'> = [1];

  if (currentPage > 3) {
    items.push('ellipsis');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (currentPage < totalPages - 2) {
    items.push('ellipsis');
  }

  items.push(totalPages);
  return items;
}

function formatEntryRange(safePage: number, perPage: number, total: number): string {
  if (total === 0) {
    return 'Showing 0 of 0 entries';
  }

  const start = (safePage - 1) * perPage + 1;
  const end = Math.min(safePage * perPage, total);
  return `Showing ${start} - ${end} of ${total} entries`;
}

function ItemsPerPageSelect({
  page,
  perPage,
  total,
}: {
  page: number;
  perPage: number;
  total: number;
}) {
  const navigate = useNavigate();
  const selectId = useId();

  return (
    <div className="flex items-center gap-2">
      <ui.Label htmlFor={selectId} className="text-sm font-normal whitespace-nowrap">
        Show
      </ui.Label>
      <ui.Select
        value={perPage.toString()}
        onValueChange={(value) => {
          const newPerPage = Number(value);
          const newPage = pageForPerPageChange(page, perPage, newPerPage, total);
          navigate(pageHref(newPage, newPerPage) || '.');
        }}
      >
        <ui.SelectTrigger id={selectId} size="sm" className="h-8 min-w-[4.75rem] text-xs">
          <ui.SelectValue />
        </ui.SelectTrigger>
        <ui.SelectContent>
          {SUBMISSIONS_PER_PAGE_OPTIONS.map((option) => (
            <ui.SelectItem key={option} value={option.toString()}>
              {option}
            </ui.SelectItem>
          ))}
        </ui.SelectContent>
      </ui.Select>
    </div>
  );
}

export function SubmissionsPagination({
  page,
  perPage,
  total,
  className,
}: SubmissionsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = buildPageItems(safePage, totalPages);
  const showPageControls = totalPages > 1;

  return (
    <div
      className={cn(
        'flex w-full items-center gap-4',
        showPageControls ? 'xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-4' : 'justify-between',
        className,
      )}
    >
      <div className="shrink-0 xl:justify-self-start">
        <ItemsPerPageSelect page={page} perPage={perPage} total={total} />
      </div>

      {showPageControls ? (
        <ui.Pagination className="mx-0 ml-auto w-auto xl:col-start-2 xl:row-start-1 xl:ml-0 xl:justify-self-center">
          <ui.PaginationContent>
            <ui.PaginationItem>
              {safePage > 1 ? (
                <ui.PaginationLink asChild size="icon" aria-label="Go to previous page">
                  <Link to={pageHref(safePage - 1, perPage)}>
                    <ChevronLeft />
                  </Link>
                </ui.PaginationLink>
              ) : (
                <ui.PaginationLink
                  size="icon"
                  className="pointer-events-none opacity-50"
                  aria-label="Go to previous page"
                  aria-disabled
                  tabIndex={-1}
                >
                  <ChevronLeft />
                </ui.PaginationLink>
              )}
            </ui.PaginationItem>

            {pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <ui.PaginationItem key={`ellipsis-${index}`}>
                  <ui.PaginationEllipsis />
                </ui.PaginationItem>
              ) : (
                <ui.PaginationItem key={item}>
                  <ui.PaginationLink asChild isActive={item === safePage}>
                    <Link to={pageHref(item, perPage)}>{item}</Link>
                  </ui.PaginationLink>
                </ui.PaginationItem>
              ),
            )}

            <ui.PaginationItem>
              {safePage < totalPages ? (
                <ui.PaginationLink asChild size="icon" aria-label="Go to next page">
                  <Link to={pageHref(safePage + 1, perPage)}>
                    <ChevronRight />
                  </Link>
                </ui.PaginationLink>
              ) : (
                <ui.PaginationLink
                  size="icon"
                  className="pointer-events-none opacity-50"
                  aria-label="Go to next page"
                  aria-disabled
                  tabIndex={-1}
                >
                  <ChevronRight />
                </ui.PaginationLink>
              )}
            </ui.PaginationItem>
          </ui.PaginationContent>
        </ui.Pagination>
      ) : null}

      <p
        className={cn(
          'text-xs whitespace-nowrap text-muted-foreground',
          showPageControls
            ? 'hidden justify-self-end xl:col-start-3 xl:row-start-1 xl:block'
            : 'shrink-0',
        )}
      >
        {formatEntryRange(safePage, perPage, total)}
      </p>
    </div>
  );
}
