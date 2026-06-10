import { create } from 'zustand'
import { InventoryItem } from '@/components/inventory/inventory-card'

interface RequestStore {
  items: { item: InventoryItem; quantity: number }[]
  notes: string
  addItem: (item: InventoryItem) => void
  updateQuantity: (itemId: string, quantity: number) => void
  removeItem: (itemId: string) => void
  setNotes: (notes: string) => void
  clear: () => void
}

export const useRequestStore = create<RequestStore>((set) => ({
  items: [],
  notes: '',
  addItem: (item) => set((state) => {
    const existing = state.items.find(i => i.item.id === item.id)
    if (existing) return state // already in list
    // enforce max 10 items
    if (state.items.length >= 10) return state
    return { items: [...state.items, { item, quantity: 1 }] }
  }),
  updateQuantity: (itemId, quantity) => set((state) => ({
    items: state.items.map(i => i.item.id === itemId ? { ...i, quantity } : i)
  })),
  removeItem: (itemId) => set((state) => ({
    items: state.items.filter(i => i.item.id !== itemId)
  })),
  setNotes: (notes) => set({ notes }),
  clear: () => set({ items: [], notes: '' }),
}))
