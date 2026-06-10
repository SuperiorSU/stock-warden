'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api/client'
import toast from 'react-hot-toast'
import { ArrowLeft, Upload, Package } from 'lucide-react'
import Link from 'next/link'

const CATEGORY_OPTIONS = [
  'Consumables', 'Stationery', 'IT & Electronics', 'Furniture', 'Laboratory',
  'Electrical & Maintenance', 'Sports', 'Hostel', 'Medical', 'Assets & Equipment',
  'Cleaning & Housekeeping', 'Transport',
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

export default function IMAddItemPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    unit: '',
    totalQuantity: 1,
    sessionYear: new Date().getFullYear(),
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: (payload: FormData) => api.post('/admin/inventory', payload),
    onSuccess: () => {
      toast.success('Item added successfully')
      router.push('/inventory-manager/items')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add item')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.category || !form.unit) {
      toast.error('Please fill in all required fields')
      return
    }
    const fd = new FormData()
    fd.append('name', form.name.trim())
    fd.append('description', form.description.trim())
    fd.append('category', form.category)
    fd.append('unit', form.unit.trim())
    fd.append('totalQuantity', String(form.totalQuantity))
    fd.append('sessionYear', String(form.sessionYear))
    if (imageFile) fd.append('imageFile', imageFile)
    addMutation.mutate(fd)
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 7 * 1024 * 1024) {
      toast.error('Image must be under 7MB')
      return
    }
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  return (
    <div className="max-w-2xl space-y-6 page-enter">
      <Link href="/inventory-manager/items" className="inline-flex items-center space-x-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary]">
        <ArrowLeft size={16} />
        <span>Back to Items</span>
      </Link>

      <div>
        <h1 className="text-2xl font-display font-bold">Add New Item</h1>
        <p className="text-sm text-[--ink-secondary]">Add a new item to inventory</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[--border-default] rounded-lg shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Item Name <span className="text-red-500">*</span></label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="e.g. A4 Paper Ream"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="Optional description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category <span className="text-red-500">*</span></label>
            <select
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="" disabled>Select category</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit <span className="text-red-500">*</span></label>
            <select
              required
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="" disabled>Select unit</option>
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Total Quantity <span className="text-red-500">*</span></label>
            <input
              required
              type="number"
              min={1}
              value={form.totalQuantity}
              onChange={(e) => setForm({ ...form, totalQuantity: Math.max(1, Number(e.target.value)) })}
              className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Session Year</label>
            <input
              type="number"
              value={form.sessionYear}
              onChange={(e) => setForm({ ...form, sessionYear: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium mb-2">Item Image</label>
          <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[--border-default] rounded-lg cursor-pointer hover:border-black transition-colors bg-[--bg-subtle] overflow-hidden">
            {imagePreview ? (
              <Image fill unoptimized src={imagePreview} alt="Preview" className="object-cover rounded-lg" />
            ) : (
              <div className="flex flex-col items-center space-y-2 text-[--ink-secondary]">
                <Upload size={24} />
                <span className="text-sm">Click to upload</span>
                <span className="text-xs">JPG, PNG, WebP · Max 7MB</span>
              </div>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} className="sr-only" />
          </label>
          {imageFile && (
            <p className="mt-1 text-xs text-[--ink-secondary]">{imageFile.name}</p>
          )}
        </div>

        <div className="pt-2 flex space-x-3">
          <Link href="/inventory-manager/items" className="flex-1 py-2 border border-[--border-default] rounded-md font-medium text-sm text-center hover:bg-[--bg-subtle]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="flex-1 py-2 bg-black text-white rounded-md font-medium text-sm hover:bg-[--accent-hover] disabled:opacity-50 transition-colors"
          >
            {addMutation.isPending ? 'Adding...' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  )
}
