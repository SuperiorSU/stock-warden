'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { InventoryCard, InventoryCardSkeleton, InventoryItem } from '@/components/inventory/inventory-card'
import { useRequestStore } from '@/lib/store/request-store'
import { toast } from 'react-hot-toast'
import { Package, Search, ShoppingCart, X } from 'lucide-react'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 450)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const cart = useRequestStore()

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', debouncedSearch],
    queryFn: async () => {
      const res = await api.get('/inventory/items', { params: { q: debouncedSearch } })
      return res.data.data
    }
  })

  const handleNotify = async (item: InventoryItem) => {
    try {
      await api.post(`/inventory/items/${item.id}/alert`, { message: 'Out of stock alert' })
      toast.success('Admin notified')
    } catch (err: any) {
      if (err.response?.status === 429) {
        toast.error('You already sent an alert recently')
      } else {
        toast.error('Failed to notify admin')
      }
    }
  }

  const handleAdd = (item: InventoryItem) => {
    if (cart.items.length >= 10) {
      toast.error('Maximum 10 items per request')
      return
    }
    cart.addItem(item)
    toast.success('Added to request')
    setIsCartOpen(true)
  }

  const handleSubmitRequest = async () => {
    if (cart.items.length === 0) return
    try {
      await api.post('/user/requests', {
        items: cart.items.map(i => ({ itemId: i.item.id, quantity: i.quantity })),
        notes: cart.notes
      })
      toast.success('Request submitted successfully')
      cart.clear()
      setIsCartOpen(false)
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error('You already have an open request for these items')
      } else {
        toast.error('Failed to submit request')
      }
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Inventory</h1>
          <p className="text-[--ink-secondary] text-sm">Browse and request available items</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[--ink-disabled]" size={18} />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-[--border-default] rounded-md focus:outline-none focus:ring-1 focus:ring-black w-full sm:w-64"
            />
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 bg-white border border-[--border-default] rounded-md hover:bg-[--bg-subtle] shrink-0"
            aria-label={cart.items.length > 0 ? `View request cart (${cart.items.length} items)` : 'View request cart'}
          >
            <ShoppingCart size={20} />
            {cart.items.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {cart.items.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <InventoryCardSkeleton key={i} />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border border-[--border-default]">
          <Package className="mx-auto text-[--ink-disabled] mb-4" size={48} />
          <h3 className="text-lg font-medium">No items found</h3>
          <p className="text-[--ink-secondary] text-sm">Try adjusting your search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data?.map((item: InventoryItem) => (
            <InventoryCard 
              key={item.id} 
              item={item} 
              onNotify={handleNotify} 
              onAdd={handleAdd} 
            />
          ))}
        </div>
      )}

      {/* Slide-over Cart */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right">
            <div className="p-4 border-b border-[--border-default] flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">New Request</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-[--ink-secondary] hover:text-[--ink-primary]">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.items.length === 0 ? (
                <div className="text-center py-10 text-[--ink-tertiary]">
                  Your request list is empty.
                </div>
              ) : (
                cart.items.map(cartItem => (
                  <div key={cartItem.item.id} className="flex space-x-4 p-3 border border-[--border-default] rounded-md">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cartItem.item.name}</p>
                      <p className="text-xs text-[--ink-secondary]">{cartItem.item.availableQty} {cartItem.item.unit} available</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="number"
                        min={1}
                        max={cartItem.item.availableQty}
                        value={cartItem.quantity}
                        onChange={(e) => cart.updateQuantity(cartItem.item.id, parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 border border-[--border-default] rounded text-sm text-center"
                      />
                      <button 
                        onClick={() => cart.removeItem(cartItem.item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[--border-default] space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea 
                  className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm"
                  rows={3}
                  value={cart.notes}
                  onChange={(e) => cart.setNotes(e.target.value)}
                  placeholder="e.g., Required for Q3 lab sessions..."
                />
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="flex-1 py-2 border border-[--border-default] rounded-md font-medium hover:bg-[--bg-subtle]"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitRequest}
                  disabled={cart.items.length === 0}
                  className="flex-1 py-2 bg-black text-white rounded-md font-medium hover:bg-[--accent-hover] disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
