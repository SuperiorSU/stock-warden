import { z } from "zod";

export const AdminStatsItemsSchema = z.object({
  sessionYear: z.coerce.number().int().optional(),
  itemId: z.string().uuid().optional(),
  monthFrom: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  monthTo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  category: z.string().optional(),
  sortBy: z.enum(["amount", "qty", "requests"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const AdminStatsRequestsSchema = z.object({
  sessionYear: z.coerce.number().int().optional(),
  granularity: z.enum(["daily", "weekly", "monthly"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const SuperAdminOverviewSchema = z.object({
  sessionYear: z.coerce.number().int().optional(),
  granularity: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  monthFrom: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  monthTo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
