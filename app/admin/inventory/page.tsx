'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { normalizeDriveImageUrl } from '@/lib/utils/drive-url'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { Plus, Search, Edit2, Archive, Package, EyeOff, Eye, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { formatINR } from '@/lib/utils/format'
import { TableWrapper } from '@/components/ui/TableWrapper'

const CATEGORY_OPTIONS = [
  'Consumables',
  'Stationery',
  'IT & Electronics',
  'Furniture',
  'Laboratory',
  'Electrical & Maintenance',
  'Sports',
  'Hostel',
  'Medical',
  'Assets & Equipment',
  'Cleaning & Housekeeping',
  'Transport',
]

const UNIT_OPTIONS = [
  { value: 'pieces', label: 'Pieces (pcs)' },
  { value: 'dozens', label: 'Dozens (dz)' },
  { value: 'reams', label: 'Reams' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'packets', label: 'Packets' },
  { value: 'sets', label: 'Sets' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'sheets', label: 'Sheets' },
  { value: 'bundles', label: 'Bundles' },
  { value: 'cartons', label: 'Cartons' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'tubes', label: 'Tubes' },
  { value: 'liters', label: 'Liters (L)' },
  { value: 'milliliters', label: 'Milliliters (mL)' },
  { value: 'kilograms', label: 'Kilograms (kg)' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'meters', label: 'Meters (m)' },
  { value: 'feet', label: 'Feet (ft)' },
  { value: 'units', label: 'Units' },
]

const PAGE_SIZE = 20

type InventoryItem = {
  id: string
  name: string
  category: string
  unit: string
  availableQty: number
  totalQuantity?: number
  imageUrl?: string | null
  unitPrice?: string | number | null
  isStale?: boolean
  isHiddenFromUsers?: boolean
}

function getErrorMessage(err: unknown, fallback: string) {
  const error = err as { response?: { data?: { error?: { message?: string } } } }
  return error.response?.data?.error?.message || fallback
}

export default function AdminInventoryPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 450)
  const [isAdding, setIsAdding] = useState(false)
  const [staleAction, setStaleAction] = useState<{ id: string; name: string; action: 'mark' | 'unmark' } | null>(null)
  const [visibilityAction, setVisibilityAction] = useState<{ id: string; name: string; hidden: boolean } | null>(null)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  const inventoryQuery = useInfiniteQuery({
    queryKey: ['admin-inventory', debouncedSearch],
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
    const flattened = inventoryQuery.data?.pages.flatMap((page) => page.data) ?? []
    const seen = new Set<string>()
    return flattened.filter((item: InventoryItem) => {
      if (!item?.id || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [inventoryQuery.data])

  const totalItems = inventoryQuery.data?.pages[0]?.meta?.total ?? 0

  const markStaleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'mark' | 'unmark' }) => api.patch(`/admin/inventory/${id}/stale`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast.success('Item status updated')
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to update item')),
  })

  const setVisibilityMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => api.patch(`/admin/inventory/${id}/visibility`, { hidden }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast.success('Visibility updated')
      setVisibilityAction(null)
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to update visibility')),
  })

  const setPriceMutation = useMutation({
    mutationFn: ({ id, unitPrice }: { id: string; unitPrice: number }) => api.put(`/admin/inventory/${id}/price`, { unitPrice, currency: 'INR' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast.success('Price updated')
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to update price')),
  })

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Inventory Management</h1>
          <p className="text-sm text-[--ink-secondary]">Manage items, update stock, and handle stale inventory</p>
        </div>

        <div className="flex items-center space-x-4 w-full md:w-auto">
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
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-2 bg-black text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[--accent-hover] transition-colors whitespace-nowrap"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      </div>

      {items.length > 0 && <CatalogValueSummary items={items} />}

      <div className="bg-white border border-[--border-default] rounded-lg shadow-sm overflow-hidden">
        {inventoryQuery.isLoading ? (
          <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
        ) : (
          <TableWrapper stackOnMobile>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[--bg-subtle] border-b border-[--border-default]">
                <tr>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] w-12 no-wrap-cap"></th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] no-wrap-cap">Name</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] hidden sm:table-cell no-wrap-cap">Category</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right no-wrap-cap">Available Qty</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right hidden md:table-cell no-wrap-cap">Unit Price</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right hidden lg:table-cell no-wrap-cap">Stock Value</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-center hidden sm:table-cell no-wrap-cap">Status</th>
                  <th className="px-6 py-4 font-medium text-[--ink-secondary] text-right no-wrap-cap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-default]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-[--ink-secondary]">No items found.</td>
                  </tr>
                ) : (
                  items.map((item: any) => (
                    <tr key={item.id} className={`hover:bg-[--bg-canvas] transition-colors ${item.isStale ? 'opacity-60' : ''}`}>
                      <td data-label="" className="px-6 py-3">
                        <div className="relative w-10 h-10 rounded border border-[--border-default] bg-[--bg-subtle] overflow-hidden flex items-center justify-center text-[--ink-disabled]">
                          {item.imageUrl ? <Image fill unoptimized src={normalizeDriveImageUrl(item.imageUrl)!} alt={item.name} className="object-cover" /> : <Package size={20} />}
                        </div>
                      </td>
                      <td data-label="Name" className="px-6 py-3 font-medium text-[--ink-primary]">{item.name}</td>
                      <td data-label="Category" className="px-6 py-3 text-[--ink-secondary] hidden sm:table-cell">{item.category}</td>
                      <td data-label="Qty" className="px-6 py-3 text-right">
                        <span className={`font-medium ${item.availableQty === 0 ? 'text-red-600' : ''}`}>{item.availableQty}</span>
                        <span className="text-[--ink-secondary] ml-1">{item.unit}</span>
                      </td>
                      <td data-label="Unit Price" className="px-6 py-3 text-right font-medium hidden md:table-cell">{item.unitPrice ? formatINR(Number(item.unitPrice)) : '-'}</td>
                      <td data-label="Stock Value" className="px-6 py-3 text-right font-medium hidden lg:table-cell">{item.unitPrice ? formatINR(Number(item.unitPrice) * Number(item.availableQty ?? 0)) : '-'}</td>
                      <td data-label="Status" className="px-6 py-3 text-center hidden sm:table-cell">
                        {item.isStale ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">Stale</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">Active</span>
                        )}
                        {item.isHiddenFromUsers ? (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Hidden</span>
                        ) : null}
                      </td>
                      <td data-label="Actions" data-full className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleSetPrice(item, setPriceMutation)} className="p-1.5 text-[--ink-secondary] hover:text-black hover:bg-green-100 rounded transition-colors" title="Set Price"><IndianRupee size={16} /></button>
                          <button onClick={() => setVisibilityAction({ id: item.id, name: item.name, hidden: !item.isHiddenFromUsers })} className="p-1.5 text-[--ink-secondary] hover:text-black hover:bg-green-100 rounded transition-colors" title={item.isHiddenFromUsers ? 'Unhide from users' : 'Hide from users'}>{item.isHiddenFromUsers ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                          <button onClick={() => setEditingItem(item)} className="p-1.5 text-[--ink-secondary] hover:text-black hover:bg-green-100 rounded transition-colors" title="Edit"><Edit2 size={16} /></button>
                          <button onClick={() => setStaleAction({ id: item.id, name: item.name, action: item.isStale ? 'unmark' : 'mark' })} className="p-1.5 text-[--ink-secondary] hover:text-amber-700 hover:bg-amber-50 rounded transition-colors" title={item.isStale ? 'Unmark Stale' : 'Mark Stale'}><Archive size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </div>

      {isAdding && <AddItemModal onClose={() => setIsAdding(false)} />}
      {editingItem && <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} />}

      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0 sm:space-x-3 text-sm text-[--ink-secondary]">
          <div>Showing {items.length} of {totalItems} items</div>
          {inventoryQuery.hasNextPage && (
            <button onClick={() => inventoryQuery.fetchNextPage()} disabled={inventoryQuery.isFetchingNextPage} className="px-4 py-2 border border-[--border-default] hover:bg-black hover:text-white transition duration-75 rounded-md font-medium disabled:opacity-50">
              {inventoryQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={staleAction !== null}
        title={staleAction?.action === 'mark' ? 'Mark Item as Stale' : 'Restore Item'}
        description={
          staleAction?.action === 'mark'
            ? `Mark "${staleAction?.name}" as stale? It will be hidden from active inventory.`
            : `Restore "${staleAction?.name}" to active inventory?`
        }
        confirmText={staleAction?.action === 'mark' ? 'Mark Stale' : 'Restore'}
        isDestructive={staleAction?.action === 'mark'}
        isLoading={markStaleMutation.isPending}
        onConfirm={() => staleAction && markStaleMutation.mutate({ id: staleAction.id, action: staleAction.action })}
        onCancel={() => setStaleAction(null)}
      />

      <ConfirmModal
        isOpen={visibilityAction !== null}
        title={visibilityAction?.hidden ? 'Hide Item from Users' : 'Unhide Item for Users'}
        description={
          visibilityAction?.hidden
            ? `Hide "${visibilityAction?.name}" from user inventory listings?`
            : `Make "${visibilityAction?.name}" visible again for users?`
        }
        confirmText={visibilityAction?.hidden ? 'Hide Item' : 'Unhide Item'}
        isDestructive={visibilityAction?.hidden}
        isLoading={setVisibilityMutation.isPending}
        onConfirm={() => visibilityAction && setVisibilityMutation.mutate({ id: visibilityAction.id, hidden: visibilityAction.hidden })}
        onCancel={() => setVisibilityAction(null)}
      />
    </div>
  )
}

function CatalogValueSummary({ items }: { items: InventoryItem[] }) {
  const stats = useMemo(() => {
    const priced = items.filter((i) => i.unitPrice != null)
    const totalValue     = priced.reduce((s, i) => s + Number(i.unitPrice!) * ((i as any).totalQuantity ?? 0), 0)
    const availableValue = priced.reduce((s, i) => s + Number(i.unitPrice!) * i.availableQty, 0)
    return { totalValue, availableValue, pricedCount: priced.length, total: items.length }
  }, [items])

  if (stats.pricedCount === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[--ink-secondary] bg-[--bg-subtle] border border-[--border-default] rounded-md px-4 py-2.5">
      <span>
        Total Catalog Value:{' '}
        <span className="font-semibold text-[--ink-primary]">{formatINR(stats.totalValue)}</span>
      </span>
      <span className="text-[--ink-disabled]">·</span>
      <span>
        Available Stock Value:{' '}
        <span className="font-semibold text-[--ink-primary]">{formatINR(stats.availableValue)}</span>
      </span>
      <span className="text-[--ink-disabled]">·</span>
      <span>{stats.pricedCount}/{stats.total} items priced</span>
    </div>
  )
}

function handleSetPrice(item: any, setPriceMutation: { mutate: (payload: { id: string; unitPrice: number }) => void }) {
  const current = item.unitPrice ? Number(item.unitPrice) : 0
  const next = window.prompt(`Set unit price for ${item.name} (INR):`, String(current))
  if (next === null) return
  const parsed = Number(next)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    toast.error('Enter a valid positive price')
    return
  }
  setPriceMutation.mutate({ id: item.id, unitPrice: Number(parsed.toFixed(2)) })
}

function AddItemModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'pieces',
    totalQuantity: 10,
    sessionYear: new Date().getFullYear(),
    description: '',
    unitPrice: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const totalValue = useMemo(() => {
    const price = Number(formData.unitPrice)
    const qty = Number(formData.totalQuantity)
    if (!formData.unitPrice || !Number.isFinite(price) || price <= 0) return null
    if (!Number.isFinite(qty) || qty <= 0) return null
    return price * qty
  }, [formData.unitPrice, formData.totalQuantity])

  const addMutation = useMutation({
    mutationFn: (payload: FormData) => api.post('/admin/inventory', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast.success('Item added successfully')
      onClose()
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to add item')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number.isFinite(formData.totalQuantity) || formData.totalQuantity <= 0) {
      toast.error("Stock quantity can't be zero.")
      return
    }
    const payload = new FormData()
    payload.append('name', formData.name)
    payload.append('category', formData.category)
    payload.append('unit', formData.unit)
    payload.append('totalQuantity', String(formData.totalQuantity))
    payload.append('sessionYear', String(formData.sessionYear))
    payload.append('description', formData.description)
    if (formData.unitPrice) payload.append('unitPrice', formData.unitPrice)
    if (imageFile) payload.append('imageFile', imageFile)
    addMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[--border-default]"><h2 className="font-display text-xl font-bold">Add New Item</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1">Item Name</label><input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option value="" disabled>Select category</option>
                {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <select required value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option value="" disabled>Select unit</option>
                {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total Quantity</label>
              <input required type="number" min={1} value={formData.totalQuantity} onChange={(e) => setFormData({ ...formData, totalQuantity: Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div><label className="block text-sm font-medium mb-1">Session Year</label><input required type="number" value={formData.sessionYear} onChange={(e) => setFormData({ ...formData, sessionYear: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" /></div>
          </div>
          {/* Unit Price */}
          <div>
            <label className="block text-sm font-medium mb-1">Unit Price (₹) <span className="text-[--ink-tertiary] font-normal">Optional</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--ink-secondary] text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="999999.99"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border rounded-md text-sm"
              />
            </div>
            {totalValue !== null && (
              <div className="mt-2 flex items-center justify-between bg-[--bg-subtle] rounded px-3 py-2 text-xs text-[--ink-secondary]">
                <span>{formData.totalQuantity} × ₹{Number(formData.unitPrice).toFixed(2)}</span>
                <span className="font-semibold text-[--ink-primary]">{formatINR(totalValue)}</span>
              </div>
            )}
            <p className="mt-1 text-xs text-[--ink-tertiary]">Used for expenditure analytics.</p>
          </div>
          <div><label className="block text-sm font-medium mb-1">Description (Optional)</label><textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div>
          <div>
            <label className="block text-sm font-medium mb-1">Item Image</label>
            <input type="file" accept="image/*" onChange={(e) => {
              const nextFile = e.target.files?.[0] ?? null
              setImageFile(nextFile)
              setImagePreview(nextFile ? URL.createObjectURL(nextFile) : null)
            }} className="w-full text-sm" />
            {imagePreview ? <div className="relative mt-3 aspect-4/3 overflow-hidden rounded-md border border-[--border-default] bg-[--bg-subtle]"><Image fill unoptimized src={imagePreview} alt="Selected item preview" className="object-cover" /></div> : <p className="mt-2 text-xs text-[--ink-secondary]">Upload an image to show on inventory cards.</p>}
          </div>
          <div className="pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-md font-medium hover:bg-[--bg-subtle]">Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="flex-1 py-2 bg-black text-white rounded-md font-medium hover:bg-[--accent-hover] disabled:opacity-50">{addMutation.isPending ? 'Adding...' : 'Add Item'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditItemModal({ item, onClose }: { item: any; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: item.name ?? '',
    category: item.category ?? '',
    unit: item.unit ?? 'pieces',
    totalQuantity: item.totalQuantity ?? item.availableQty ?? 0,
    description: item.description ?? '',
    unitPrice: item.unitPrice != null ? String(Number(item.unitPrice)) : '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    normalizeDriveImageUrl(item.imageUrl) ?? null
  )

  const totalValue = useMemo(() => {
    const price = Number(formData.unitPrice)
    const qty = Number(formData.totalQuantity)
    if (!formData.unitPrice || !Number.isFinite(price) || price <= 0) return null
    if (!Number.isFinite(qty) || qty <= 0) return null
    return price * qty
  }, [formData.unitPrice, formData.totalQuantity])

  const updateMutation = useMutation({
    mutationFn: (payload: FormData) => api.put(`/admin/inventory/${item.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast.success('Item updated successfully')
      onClose()
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to update item')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!Number.isFinite(formData.totalQuantity) || formData.totalQuantity <= 0) {
      toast.error("Stock quantity can't be zero.")
      return
    }
    const payload = new FormData()
    payload.append('name', formData.name)
    payload.append('category', formData.category)
    payload.append('unit', formData.unit)
    payload.append('totalQuantity', String(formData.totalQuantity))
    payload.append('description', formData.description)
    if (formData.unitPrice) payload.append('unitPrice', formData.unitPrice)
    if (imageFile) payload.append('imageFile', imageFile)
    updateMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[--border-default]"><h2 className="font-display text-xl font-bold">Edit Item</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1">Item Name</label><input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <select required value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option value="" disabled>Select unit</option>
                {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Quantity</label>
            <input required type="number" min={1} value={formData.totalQuantity} onChange={(e) => setFormData({ ...formData, totalQuantity: Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
          </div>
          {/* Unit Price */}
          <div>
            <label className="block text-sm font-medium mb-1">Unit Price (₹) <span className="text-[--ink-tertiary] font-normal">Optional</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--ink-secondary] text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="999999.99"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border rounded-md text-sm"
              />
            </div>
            {totalValue !== null && (
              <div className="mt-2 flex items-center justify-between bg-[--bg-subtle] rounded px-3 py-2 text-xs text-[--ink-secondary]">
                <span>{formData.totalQuantity} × ₹{Number(formData.unitPrice).toFixed(2)}</span>
                <span className="font-semibold text-[--ink-primary]">{formatINR(totalValue)}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Replace Image</label>
            <input type="file" accept="image/*" onChange={(e) => {
              const nextFile = e.target.files?.[0] ?? null
              setImageFile(nextFile)
              setImagePreview(nextFile ? URL.createObjectURL(nextFile) : item.imageUrl ?? null)
            }} className="w-full text-sm" />
            {imagePreview ? <div className="relative mt-3 aspect-4/3 overflow-hidden rounded-md border border-[--border-default] bg-[--bg-subtle]"><Image fill unoptimized src={imagePreview} alt={formData.name || 'Item preview'} className="object-cover" /></div> : <p className="mt-2 text-xs text-[--ink-secondary]">No image uploaded yet.</p>}
          </div>
          <div><label className="block text-sm font-medium mb-1">Description (Optional)</label><textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div>
          <div className="pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-md font-medium hover:bg-[--bg-subtle]">Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className="flex-1 py-2 bg-black text-white rounded-md font-medium hover:bg-[--accent-hover] disabled:opacity-50">{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
