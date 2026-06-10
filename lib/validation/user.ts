import { z } from "zod";

export const UserRequestFilterSchema = z.object({
  status: z.string().optional(),
  sessionYear: z.coerce.number().int().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const NotificationFilterSchema = z.object({
  isRead: z.enum(["true", "false"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const StockAlertSchema = z.object({
  message: z.string().max(300).optional(),
});
