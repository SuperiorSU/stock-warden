import { z } from "zod";

export const InventoryFilterSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  sessionYear: z.coerce.number().int().optional(),
  availability: z.enum(["in_stock", "out_of_stock"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
