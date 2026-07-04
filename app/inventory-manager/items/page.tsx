'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { normalizeDriveImageUrl } from '@/lib/utils/drive-url'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { Plus, Search, Package } from 'lucide-react'
import Link from 'next/link'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

const PAGE_SIZE = 20

export default function IMItemsPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 450)

  const inventoryQuery = useInfiniteQuery({
    queryKey: ['im-inventory', debouncedSearch],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get('/admin/inventory', {
        params: { q: debouncedSearch || undefined, cursor: pageParam, limit: PAGE_SIZE },
      })
      return res.data
    },
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  })

  const items = useMemo(() => {
    const flattened = inventoryQuery.data?.pages.flatMap((p) => p.data) ?? []
    const seen = new Set<string>()
    return flattened.filter((item: any) => {
      if (!item?.id || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [inventoryQuery.data])

  const total = inventoryQuery.data?.pages[0]?.meta?.total ?? 0

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        <div>
          <h1 className="text-2xl font-display font-bold">All Items</h1>
          <p className="text-sm text-[--ink-secondary]">Browse and manage inventory stock</p>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[--ink-disabled]" size={16} />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <Link
            href="/inventory-manager/items/new"
            className="flex items-center space-x-2 bg-black text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[--accent-hover] transition-colors whitespace-nowrap"
          >
            <Plus size={16} />
            <span>Add Item</span>
          </Link>
        </div>
      </div>

      {inventoryQuery.isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm">Couldn&apos;t load inventory items.</span>
          <button onClick={() => inventoryQuery.refetch()} className="text-sm font-medium underline">Retry</button>
        </div>
      )}

      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        {inventoryQuery.isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] w-12" />
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Name</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary]">Category</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Available</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[--ink-secondary]">No items found.</td>
                  </tr>
                ) : (
                  items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[--bg-canvas] transition-colors">
                      <td className="px-6 py-3">
                        <div className="relative w-10 h-10 rounded border border-[--border-default] bg-[--bg-subtle] overflow-hidden flex items-center justify-center text-[--ink-disabled]">
                          {item.imageUrl
                            ? <Image fill unoptimized src={normalizeDriveImageUrl(item.imageUrl)!} alt={item.name} className="object-contain absolute z-10"  />
                            : <Package size={20} />}
                        </div>
                      </td>
                      <td className="px-6 py-3 font-medium text-[--ink-primary]">{item.name}</td>
                      <td className="px-6 py-3 text-[--ink-secondary]">{item.category ?? '-'}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`font-medium ${item.availableQty === 0 ? 'text-red-600' : ''}`}>{item.availableQty}</span>
                        <span className="text-[--ink-secondary] ml-1">{item.unit}</span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {item.isStale && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">Stale</span>}
                          {item.isHiddenFromUsers && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Hidden</span>}
                          {!item.isStale && !item.isHiddenFromUsers && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">Active</span>}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link
                          href={`/inventory-manager/items/${item.id}`}
                          className="text-sm font-medium text-[--ink-secondary] hover:text-black hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[--ink-secondary]">
          <span>Showing {items.length} of {total} items</span>
          {inventoryQuery.hasNextPage && (
            <button
              onClick={() => inventoryQuery.fetchNextPage()}
              disabled={inventoryQuery.isFetchingNextPage}
              className="px-4 py-2 border border-[--border-default] hover:bg-black hover:text-white transition duration-75 rounded-md font-medium disabled:opacity-50"
            >
              {inventoryQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
