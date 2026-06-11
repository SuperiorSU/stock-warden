import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { AdminInventoryCreateSchema } from "@/lib/validation/admin";
import { InventoryFilterSchema } from "@/lib/validation/inventory";
import { paginateWithCursor } from "@/lib/pagination/cursor";
import { decodeCursor, encodeCursor } from "@/lib/pagination/secure-cursor";
import { ApiError } from "@/lib/errors";
import { slugify, withSlugSuffix } from "@/lib/utils/slug";
import { writeAuditLog } from "@/lib/audit/log";
import { uploadItemImageToDrive } from "@/lib/storage/drive";
import { cached, invalidatePattern } from "@/lib/cache/redis";

const adminInventorySelect = {
  id: true,
  name: true,
  category: true,
  unit: true,
  availableQty: true,
  totalQuantity: true,
  imageUrl: true,
  unitPrice: true,
  currency: true,
  isStale: true,
  isActive: true,
  isHiddenFromUsers: true,
  createdAt: true,
} as const;

async function parseInventoryCreateRequest(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const imageFile = formData.get("imageFile");

    const rawUnitPrice = formData.get("unitPrice")
    return {
      body: {
        name: String(formData.get("name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || undefined,
        category: String(formData.get("category") ?? "").trim() || undefined,
        unit: String(formData.get("unit") ?? "").trim(),
        totalQuantity: Number(formData.get("totalQuantity") ?? 0),
        sessionYear: Number(formData.get("sessionYear") ?? 0),
        imageUrl: String(formData.get("imageUrl") ?? "").trim() || undefined,
        unitPrice: rawUnitPrice !== null && rawUnitPrice !== "" ? Number(rawUnitPrice) : undefined,
      },
      imageFile: imageFile instanceof File && imageFile.size > 0 ? imageFile : null,
    };
  }

  return {
    body: await req.json(),
    imageFile: null,
  };
}

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const url = new URL(req.url);
  const parsed = InventoryFilterSchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    sessionYear: url.searchParams.get("sessionYear") ?? undefined,
    availability: url.searchParams.get("availability") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const isStale = url.searchParams.get("isStale");
  const isActive = url.searchParams.get("isActive");
  const hidden = url.searchParams.get("hidden");

  const { q, category, sessionYear, availability, cursor, limit = 20 } = parsed.data;

  let decodedCursor: { id: string; createdAt: Date } | null = null;
  if (cursor) {
    try {
      decodedCursor = decodeCursor(cursor);
    } catch (error) {
      if (error instanceof ApiError) {
        return apiError(error);
      }
      throw error;
    }
  }

  const where: Record<string, unknown> = {
    ...(q
      ? {
          name: {
            contains: q,
            mode: "insensitive",
          },
        }
      : {}),
    ...(category ? { category } : {}),
    ...(sessionYear ? { sessionYear } : {}),
    ...(availability === "in_stock" ? { availableQty: { gt: 0 } } : {}),
    ...(availability === "out_of_stock" ? { availableQty: 0 } : {}),
    ...(isStale ? { isStale: isStale === "true" } : {}),
    ...(isActive ? { isActive: isActive === "true" } : {}),
    ...(hidden === "true" ? { isHiddenFromUsers: true } : hidden === "false" ? { isHiddenFromUsers: false } : {}),
  };

  const cacheKey = `admin:inventory:q=${q ?? ""}:cat=${category ?? ""}:yr=${sessionYear ?? ""}:avail=${availability ?? ""}:stale=${isStale ?? ""}:active=${isActive ?? ""}:hidden=${hidden ?? ""}:cur=${cursor ?? ""}:lim=${limit}`;

  const result = await cached(cacheKey, 120, async () => {
    const page = await paginateWithCursor(
      (args) =>
        prisma.inventoryItem.findMany({
          where,
          take: args.take,
          cursor: args.cursor,
          skip: args.skip,
          orderBy: { createdAt: "desc" },
          select: adminInventorySelect,
        }),
      () => prisma.inventoryItem.count({ where }),
      { cursor: decodedCursor?.id, limit }
    );

    const lastItem = page.items[page.items.length - 1] as { id: string; createdAt: Date } | undefined;
    const nextCursor = lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

    return {
      items: page.items,
      meta: { limit, total: page.total, hasMore: page.hasMore, nextCursor },
    };
  });

  return apiSuccess(result.items, result.meta);
}

export async function POST(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { body, imageFile } = await parseInventoryCreateRequest(req);
  const parsed = AdminInventoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const { name, sessionYear, category } = parsed.data;

  const existing = await prisma.inventoryItem.findFirst({
    where: { name, sessionYear, category: category ?? null },
  });

  if (existing) {
    return apiError(new ConflictError("DUPLICATE_ITEM"));
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  const slugExists = await prisma.inventoryItem.findUnique({ where: { slug } });
  if (slugExists) {
    slug = withSlugSuffix(baseSlug);
  }

  let uploadFileName = imageFile?.name || `${slug}.png`
  if (imageFile) {
    const ext = uploadFileName.split('.').pop()?.toLowerCase() ?? 'jpg'
    uploadFileName = `item-${crypto.randomUUID()}-${Date.now()}.${ext}`
  }
  const imageUrl = imageFile
    ? await uploadItemImageToDrive(Buffer.from(await imageFile.arrayBuffer()), uploadFileName, imageFile.type || "image/png")
    : parsed.data.imageUrl;

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        ...parsed.data,
        imageUrl,
        slug,
        availableQty: parsed.data.totalQuantity,
        createdBy: user.id,
      },
    });

    await tx.stockHistory.create({
      data: {
        itemId: item.id,
        changeType: "ADDED",
        quantityDelta: parsed.data.totalQuantity,
        quantityAfter: parsed.data.totalQuantity,
        changedBy: user.id,
        notes: "Initial stock added",
      },
    });

    return item;
  });

  await writeAuditLog({
    userId: user.id,
    action: "ITEM_CREATED",
    entity: "InventoryItem",
    entityId: created.id,
    metadata: { name: created.name },
  });

  await invalidatePattern("admin:inventory:*");

  return apiSuccess(created);
}

export const dynamic = "force-dynamic";
