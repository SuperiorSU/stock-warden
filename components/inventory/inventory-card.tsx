import Image from 'next/image'
import { PackageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeDriveImageUrl } from '@/lib/utils/drive-url'

export interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  availableQty: number
  imageUrl?: string | null
}

export function InventoryCard({ 
  item, 
  onNotify, 
  onAdd 
}: { 
  item: InventoryItem
  onNotify?: (item: InventoryItem) => void
  onAdd?: (item: InventoryItem) => void
}) {
  const isOutOfStock = item.availableQty === 0

  return (
    <div className="group relative bg-white border border-[--border-default] rounded-lg overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Image */}
      <div className="aspect-4/3 overflow-hidden bg-[--bg-subtle] relative">
        {item.imageUrl ? (
          <Image
            fill
            unoptimized
            src={normalizeDriveImageUrl(item.imageUrl)!}
            alt={item.name}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[--ink-disabled]">
            <PackageIcon size={32} />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="text-xs font-semibold text-red-600 tracking-wider uppercase">Out of Stock</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 flex flex-col h-[116px]">
        <h3 className="text-sm font-semibold text-[--ink-primary] line-clamp-2 mb-1" title={item.name}>
          {item.name}
        </h3>
        <p className="text-xs text-[--ink-tertiary] mb-3">{item.category}</p>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xs text-[--ink-secondary]">
            {isOutOfStock ? (
              <span className="text-red-600 font-medium">Unavailable</span>
            ) : (
              <><span className="font-medium text-[--ink-primary]">{item.availableQty}</span> {item.unit}</>
            )}
          </span>
          {isOutOfStock ? (
            <button 
              className="text-xs text-black hover:underline font-medium"
              onClick={() => onNotify?.(item)}
            >
              Notify me
            </button>
          ) : (
            <button 
              className="text-xs bg-black text-white cursor-pointer px-3 py-1.5 rounded hover:bg-[--accent-hover] transition-colors font-medium"
              onClick={() => onAdd?.(item)}
            >
              Add to Request
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function InventoryCardSkeleton() {
  return (
    <div className="animate-pulse border border-[--border-default] rounded-lg overflow-hidden bg-white">
      <div className="aspect-4/3 bg-[--bg-subtle]" />
      <div className="p-4 h-[116px] flex flex-col justify-between">
        <div>
          <div className="h-4 bg-[--bg-subtle] rounded w-3/4 mb-2" />
          <div className="h-3 bg-[--bg-subtle] rounded w-1/3" />
        </div>
        <div className="flex justify-between items-center">
          <div className="h-4 bg-[--bg-subtle] rounded w-12" />
          <div className="h-6 bg-[--bg-subtle] rounded w-24" />
        </div>
      </div>
    </div>
  )
}
