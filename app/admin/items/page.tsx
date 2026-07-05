import { SAItemsExplorer } from '@/components/super-admin/SAItemsExplorer'

export default function AdminItemsPage() {
  return <SAItemsExplorer itemsBasePath="/admin/items" employeeBasePath="/admin/employees" />
}
