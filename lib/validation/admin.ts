import { z } from "zod";

export const AdminInventoryCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.string().max(120).optional(),
  unit: z.string().min(1).max(50),
  totalQuantity: z.number().int().min(1).max(10000),
  sessionYear: z.number().int(),
  imageUrl: z.string().url().optional(),
  unitPrice: z.number().positive().max(999999.99).optional(),
});

export const AdminInventoryUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(120).optional(),
  unit: z.string().min(1).max(50).optional(),
  totalQuantity: z.number().int().min(1).max(10000).optional(),
  imageUrl: z.string().url().optional(),
  unitPrice: z.number().positive().max(999999.99).optional(),
});

export const AdminInventoryStaleSchema = z.object({
  action: z.enum(["mark", "unmark"]),
});

export const AdminRequestStatusSchema = z.object({
  adminNotes: z.string().max(500).optional(),
});

export const AdminRequestFilterSchema = z.object({
  status: z.string().optional(),
  userId: z.string().uuid().optional(),
  department: z.string().optional(),
  itemId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sessionYear: z.coerce.number().int().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const AdminStockAlertFilterSchema = z.object({
  isRead: z.enum(["true", "false"]).optional(),
  itemId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
