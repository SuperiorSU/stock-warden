import Image from 'next/image'
import { PackageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeDriveImageUrl } from '@/lib/utils/drive-url'

export interface InventoryItem {
  id:           string
  name:         string
  category:     string
  unit:         string
  availableQty: number
  imageUrl?:    string | null
}

export function InventoryCard({
  item, onNotify, onAdd
}: {
  item:       InventoryItem
  onNotify?:  (item: InventoryItem) => void
  onAdd?:     (item: InventoryItem) => void
}) {
  const isOutOfStock = item.availableQty === 0

  return (
    <div className="group relative bg-surface border border-border rounded-lg overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Image */}
      <div className="aspect-4/3 overflow-hidden bg-sunken relative">
        {item.imageUrl ? (
          <Image
            fill
            unoptimized
            src={normalizeDriveImageUrl(item.imageUrl)!}
            alt={item.name}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-4">
            <PackageIcon size={32} />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="text-12 font-semibold text-status-negative tracking-wider uppercase">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col h-29">
        <h3 className="text-14 font-semibold text-ink-1 line-clamp-2 mb-1" title={item.name}>
          {item.name}
        </h3>
        <p className="text-12 text-ink-3 mb-3">{item.category}</p>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-13 text-ink-2">
            {isOutOfStock ? (
              <span className="text-status-negative font-medium">Unavailable</span>
            ) : (
              <><span className="font-semibold text-ink-1">{item.availableQty}</span>{' '}{item.unit}</>
            )}
          </span>

          {isOutOfStock ? (
            <button
              type="button"
              onClick={() => onNotify?.(item)}
              className={cn(
                'text-13 font-medium px-3 py-1.5 rounded-md',
                'border border-border text-ink-2',
                'hover:bg-sunken hover:text-ink-1 hover:border-border-strong',
                'active:scale-[0.97] transition-all duration-150',
                'cursor-pointer'
              )}
            >
              Notify me
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAdd?.(item)}
              className={cn(
                'text-13 font-medium px-3 py-1.5 rounded-md',
                'bg-accent text-white',
                'hover:bg-accent-mid active:bg-accent/90',
                'active:scale-[0.97] transition-all duration-150',
                'cursor-pointer'
              )}
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
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="aspect-4/3 skeleton" />
      <div className="p-4 h-29 flex flex-col justify-between">
        <div>
          <div className="skeleton h-4 w-3/4 rounded mb-2" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
        <div className="flex justify-between items-center">
          <div className="skeleton h-4 w-12 rounded" />
          <div className="skeleton h-7 w-24 rounded" />
        </div>
      </div>
    </div>
  )
}
