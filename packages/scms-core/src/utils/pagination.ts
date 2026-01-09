/**
 * Calculate the page values for the given total and options for previous and next pages.
 * Will return the previous and next page numbers only if they are in range.
 *
 * @param total
 * @param opts
 * @returns
 */
export function getPageValues(total: number, opts: { page?: number; limit?: number }) {
  let prev, next;
  if (opts?.limit) {
    if (opts.page) {
      const prevPage = Math.max(0, opts.page - 1);
      if (prevPage * opts.limit < total) {
        prev = prevPage;
      } else {
        // If we are beyond the last page, prev takes you back to last page
        prev = Math.max(0, Math.ceil(total / opts.limit - 1));
      }
    }
    const nextPage = (opts.page ?? 0) + 1;
    if (nextPage * opts.limit < total) next = nextPage;
  }
  return { prev, next };
}

/**
 * Make pagination links using the given links object and total count of items.
 * Will update self link to include page/limit query params.
 * Will append the `prev` and `next` links if they are in range.
 *
 * @param links
 * @param total
 * @param opts
 * @returns
 */
export function makePaginationLinks<T extends { self: string; [key: string]: string }>(
  links: T,
  total: number,
  opts: { page?: number; limit?: number },
) {
  const updated: T & { prev?: string; next?: string } = { ...links };

  // no pagination if limit and page are not provided
  if (opts.limit === undefined && opts.page === undefined) {
    return links;
  }

  if (opts.limit || opts.page) {
    const selfUrl = new URL(links.self);
    if (opts.page) selfUrl.searchParams.set('page', opts.page.toString());
    if (opts.limit && (opts.page || opts.limit < total)) {
      selfUrl.searchParams.set('limit', opts.limit.toString());
    }
    updated.self = selfUrl.toString();
  }

  const pages = getPageValues(total, opts);
  if (opts.limit && pages.prev !== undefined) {
    const prevUrl = new URL(links.self);
    prevUrl.searchParams.set('page', pages.prev.toString());
    prevUrl.searchParams.set('limit', opts.limit.toString());
    updated.prev = prevUrl.toString();
  }

  if (opts.limit && pages.next !== undefined) {
    const nextUrl = new URL(links.self);
    nextUrl.searchParams.set('page', pages.next.toString());
    nextUrl.searchParams.set('limit', opts.limit.toString());
    updated.next = nextUrl.toString();
  }

  return updated;
}
