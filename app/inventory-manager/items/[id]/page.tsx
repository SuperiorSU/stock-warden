'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { normalizeDriveImageUrl } from '@/lib/utils/drive-url'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import toast from 'react-hot-toast'
import { ArrowLeft, Upload, Package } from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/utils/format'

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

type FormData = {
  name: string
  category: string
  unit: string
  totalQuantity: number
  description: string
  unitPrice: string
}

export default function IMEditItemPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: item, isLoading } = useQuery({
    queryKey: ['im-item', id],
    queryFn: async () => {
      const res = await api.get(`/admin/inventory/${id}`)
      return res.data.data
    },
  })

  const [form, setForm] = useState<FormData>({
    name: '',
    category: '',
    unit: 'pieces',
    totalQuantity: 1,
    description: '',
    unitPrice: '',
  })
  const [formReady, setFormReady] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    if (item && !formReady) {
      setForm({
        name: item.name ?? '',
        category: item.category ?? '',
        unit: item.unit ?? 'pieces',
        totalQuantity: item.totalQuantity ?? item.availableQty ?? 1,
        description: item.description ?? '',
        unitPrice: item.unitPrice != null ? String(Number(item.unitPrice)) : '',
      })
      setFormReady(true)
    }
  }, [item, formReady])

  const totalValue = useMemo(() => {
    const price = Number(form.unitPrice)
    const qty = Number(form.totalQuantity)
    if (!form.unitPrice || !Number.isFinite(price) || price <= 0) return null
    if (!Number.isFinite(qty) || qty <= 0) return null
    return price * qty
  }, [form.unitPrice, form.totalQuantity])

  const updateMutation = useMutation({
    mutationFn: (fd: FormData) => api.put(`/admin/inventory/${id}`, fd),
    onSuccess: () => {
      toast.success('Item details saved successfully.')
      queryClient.invalidateQueries({ queryKey: ['im-item', id] })
      queryClient.invalidateQueries({ queryKey: ['im-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['im-inventory-all'] })
      router.push('/inventory-manager/items')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Could not save item changes. Please try again.'),
  })

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 7 * 1024 * 1024) { toast.error('Image must be under 7MB'); return }
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(form.totalQuantity) || form.totalQuantity < 1) {
      toast.error('Quantity must be at least 1')
      return
    }
    const fd = new FormData()
    fd.append('name', form.name.trim())
    fd.append('category', form.category)
    fd.append('unit', form.unit)
    fd.append('totalQuantity', String(form.totalQuantity))
    fd.append('description', form.description.trim())
    if (form.unitPrice) fd.append('unitPrice', form.unitPrice)
    if (imageFile) fd.append('imageFile', imageFile)
    updateMutation.mutate(fd as any)
  }

  if (isLoading || !formReady) {
    return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }
  if (!item) return <div className="p-8 text-center text-[--ink-secondary]">Item not found.</div>

  const currentImage = imagePreview ?? (item.imageUrl ? normalizeDriveImageUrl(item.imageUrl) : null)

  return (
    <div className="max-w-2xl space-y-6 page-enter">
      <Link href="/inventory-manager/items" className="inline-flex items-center space-x-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary]">
        <ArrowLeft size={16} />
        <span>Back to Items</span>
      </Link>

      <div>
        <h1 className="text-2xl font-display font-bold">Edit Item</h1>
        <p className="text-sm text-[--ink-secondary]">Update item details, quantity, price, or image</p>
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
              {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Total Quantity <span className="text-red-500">*</span></label>
          <input
            required
            type="number"
            min={1}
            value={form.totalQuantity}
            onChange={(e) => setForm({ ...form, totalQuantity: Math.max(1, Number(e.target.value)) })}
            className="w-40 px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          <p className="mt-1 text-xs text-[--ink-secondary]">
            Currently available: {item.availableQty} {item.unit}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Unit Price (₹) <span className="text-[--ink-tertiary] font-normal">Optional</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--ink-secondary] text-sm">₹</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="999999.99"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          {totalValue !== null && (
            <div className="mt-2 flex items-center justify-between bg-[--bg-subtle] rounded px-3 py-2 text-xs text-[--ink-secondary]">
              <span>{form.totalQuantity} × ₹{Number(form.unitPrice).toFixed(2)}</span>
              <span className="font-semibold text-[--ink-primary]">{formatINR(totalValue)}</span>
            </div>
          )}
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

        <div>
          <label className="block text-sm font-medium mb-2">Item Image</label>
          <div className="flex items-start space-x-4">
            <div className="relative w-28 h-28 rounded-lg border border-[--border-default] bg-[--bg-subtle] overflow-hidden flex items-center justify-center text-[--ink-disabled] shrink-0">
              {currentImage
                ? <Image fill unoptimized src={currentImage} alt={form.name || 'Item'} className="object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <Package size={32} />}
            </div>
            <div className="flex-1">
              <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-[--ink-secondary] hover:text-black border border-[--border-default] rounded-md px-3 py-2 hover:bg-[--bg-subtle] transition-colors w-fit">
                <Upload size={16} />
                <span>{item.imageUrl ? 'Replace Image' : 'Upload Image'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} className="sr-only" />
              </label>
              <p className="mt-1 text-xs text-[--ink-secondary]">JPG, PNG, WebP · Max 7MB</p>
              {imageFile && <p className="mt-1 text-xs text-green-700">{imageFile.name} selected</p>}
            </div>
          </div>
        </div>

        <div className="pt-2 flex space-x-3">
          <Link href="/inventory-manager/items" className="flex-1 py-2 border border-[--border-default] rounded-md font-medium text-sm text-center hover:bg-[--bg-subtle]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1 py-2 bg-black text-white rounded-md font-medium text-sm hover:bg-[--accent-hover] disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
