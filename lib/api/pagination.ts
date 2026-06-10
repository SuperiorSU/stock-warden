import { apiSuccess } from "@/lib/api/response";
import type { CursorPage } from "@/lib/pagination/cursor";

export function apiPaginated<T>(page: CursorPage<T>, limit: number) {
  return apiSuccess(page.items, {
    limit,
    total: page.total,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  });
}
