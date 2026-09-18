import type { Paginated, PaginationMeta } from '@social-network/shared';

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

export interface PageArgs {
  page?: number;
  perPage?: number;
}

/** Traduce `page`/`perPage` a los `skip`/`limit` de Mongo. */
export function toPage(args: PageArgs): {
  skip: number;
  take: number;
  page: number;
  perPage: number;
} {
  const page = Math.max(1, Math.trunc(args.page ?? 1));
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.trunc(args.perPage ?? DEFAULT_PER_PAGE)));

  return { skip: (page - 1) * perPage, take: perPage, page, perPage };
}

export function buildMeta(total: number, page: number, perPage: number): PaginationMeta {
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return {
    page,
    perPage,
    total,
    lastPage,
    hasNextPage: page < lastPage,
    hasPreviousPage: page > 1,
  };
}

export function paginate<T>(data: T[], total: number, page: number, perPage: number): Paginated<T> {
  return { data, meta: buildMeta(total, page, perPage) };
}
