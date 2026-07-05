'use client'

import { useParams } from 'next/navigation'
import { SAItemDetail } from '@/components/super-admin/SAItemDetail'

export default function AdminItemDetailsPage() {
  const params = useParams()
  const itemId = params.id as string
  return <SAItemDetail itemId={itemId} itemsBasePath="/admin/items" employeeBasePath="/admin/employees" />
}
