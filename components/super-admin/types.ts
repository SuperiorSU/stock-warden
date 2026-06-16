export type RequestStatus =
  | "REQUESTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface SARequestItem {
  id: string;
  quantityReq: number;
  quantityAllocated: number | null;
  quantityFul: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  item: {
    id: string;
    name: string;
    unit: string;
    category: string | null;
  };
}

export interface SARequest {
  id: string;
  status: RequestStatus;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  processedAt: string | null;
  sessionYear: number;
  allocatedByAdminAt: string | null;
  inventoryProcessedAt: string | null;
  receiptNumber: string | null;
  adminName: string | null;
  inventoryManagerName: string | null;
  totalAmount: number | null;
  user: {
    id: string;
    name: string;
    employeeId: string | null;
    department: string | null;
    designation: string | null;
  };
  items: SARequestItem[];
}

export interface SAFilters {
  sessionYear: number;
  monthFrom: string | null;
  monthTo: string | null;
  department: string | null;
  status: RequestStatus | null;
  itemId: string | null;
  sortBy: "date" | "amount" | "items";
  order: "asc" | "desc";
}

export const DEFAULT_FILTERS: SAFilters = {
  sessionYear: new Date().getFullYear(),
  monthFrom: null,
  monthTo: null,
  department: null,
  status: null,
  itemId: null,
  sortBy: "date",
  order: "desc",
};
