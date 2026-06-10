export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export async function paginateWithCursor<T extends { id: string }>(
  query: (args: { take: number; cursor?: { id: string }; skip?: number }) => Promise<T[]>,
  countQuery: () => Promise<number>,
  { cursor, limit = 20 }: { cursor?: string; limit?: number }
): Promise<CursorPage<T>> {
  const take = Math.min(limit, 50) + 1;

  const items = await query({
    take,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : undefined,
  });

  const hasMore = items.length > take - 1;
  const page = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? page[page.length - 1].id : null;
  const total = await countQuery();

  return { items: page, nextCursor, hasMore, total };
}
