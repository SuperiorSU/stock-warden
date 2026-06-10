'use client'

import Image from 'next/image'
import { useState } from 'react'
import { normalizeDriveImageUrl } from '@/lib/utils/drive-url'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import toast from 'react-hot-toast'
import { ArrowLeft, Upload, Package } from 'lucide-react'
import Link from 'next/link'

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

  const [totalQuantity, setTotalQuantity] = useState<number | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: (fd: FormData) => api.put(`/admin/inventory/${id}`, fd),
    onSuccess: () => {
      toast.success('Item updated')
      queryClient.invalidateQueries({ queryKey: ['im-item', id] })
      queryClient.invalidateQueries({ queryKey: ['im-inventory'] })
      router.push('/inventory-manager/items')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update item'),
  })

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 7 * 1024 * 1024) { toast.error('Image must be under 7MB'); return }
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = totalQuantity ?? item?.totalQuantity
    if (!qty || qty < 1) { toast.error('Quantity must be at least 1'); return }
    const fd = new FormData()
    fd.append('totalQuantity', String(qty))
    if (imageFile) fd.append('imageFile', imageFile)
    updateMutation.mutate(fd)
  }

  if (isLoading) {
    return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" /></div>
  }
  if (!item) return <div className="p-8 text-center text-[--ink-secondary]">Item not found.</div>

  const currentQty = totalQuantity ?? item.totalQuantity
  const currentImage = imagePreview ?? item.imageUrl ?? null

  return (
    <div className="max-w-2xl space-y-6 page-enter">
      <Link href="/inventory-manager/items" className="inline-flex items-center space-x-2 text-sm font-medium text-[--ink-secondary] hover:text-[--ink-primary]">
        <ArrowLeft size={16} />
        <span>Back to Items</span>
      </Link>

      <div>
        <h1 className="text-2xl font-display font-bold">Edit Item</h1>
        <p className="text-sm text-[--ink-secondary]">Update quantity or image for this item</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[--border-default] rounded-lg shadow-sm p-6 space-y-5">
        {/* Read-only fields */}
        <div className="space-y-4 pb-4 border-b border-[--border-default]">
          <ReadOnlyField label="Item Name" value={item.name} />
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Category" value={item.category ?? '-'} />
            <ReadOnlyField label="Unit" value={item.unit} />
          </div>
          <ReadOnlyField
            label="Unit Price"
            value={item.unitPrice ? `₹${Number(item.unitPrice).toFixed(2)}` : 'No price set'}
          />
        </div>

        {/* Editable: image */}
        <div>
          <label className="block text-sm font-medium mb-2">Item Image</label>
          <div className="flex items-start space-x-4">
            <div className="relative w-28 h-28 rounded-lg border border-[--border-default] bg-[--bg-subtle] overflow-hidden flex items-center justify-center text-[--ink-disabled] shrink-0">
              {currentImage
                ? <Image fill unoptimized src={normalizeDriveImageUrl(currentImage)!} alt={item.name} className="object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
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

        {/* Editable: quantity */}
        <div>
          <label className="block text-sm font-medium mb-1">Total Quantity</label>
          <input
            type="number"
            min={1}
            value={currentQty}
            onChange={(e) => setTotalQuantity(Math.max(1, Number(e.target.value)))}
            className="w-40 px-3 py-2 border border-[--border-default] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          <p className="mt-1 text-xs text-[--ink-secondary]">
            Currently available: {item.availableQty} {item.unit}
          </p>
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[--ink-secondary] uppercase tracking-wider mb-1">{label}</label>
      <div className="px-3 py-2 bg-[--bg-subtle] rounded-md text-sm text-[--ink-tertiary] border border-[--border-default]">
        {value}
      </div>
    </div>
  )
}
