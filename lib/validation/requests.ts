import { z } from "zod";

export const CreateRequestSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(500),
      })
    )
    .min(1)
    .max(10),
  notes: z.string().max(500).optional(),
});

export const CancelRequestSchema = z.object({
  requestId: z.string().uuid(),
});

export const ReRequestSchema = z.object({
  requestId: z.string().uuid(),
});

export const InventoryManagerRequestActionSchema = z.object({
  notes: z.string().max(500).optional(),
});
