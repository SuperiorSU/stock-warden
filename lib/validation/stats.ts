import { z } from "zod";

export const AdminStatsItemsSchema = z.object({
  sessionYear: z.coerce.number().int().optional(),
  itemId: z.string().uuid().optional(),
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
});
