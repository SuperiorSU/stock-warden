import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { AdminInventoryUpdateSchema } from "@/lib/validation/admin";
import { writeAuditLog } from "@/lib/audit/log";
import { uploadItemImageToDrive, extractDriveFileId, deleteFileFromDrive } from "@/lib/storage/drive";

async function parseInventoryUpdateRequest(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const imageFile = formData.get("imageFile");

    return {
      body: {
        name: String(formData.get("name") ?? "").trim() || undefined,
        description: String(formData.get("description") ?? "").trim() || undefined,
        category: String(formData.get("category") ?? "").trim() || undefined,
        unit: String(formData.get("unit") ?? "").trim() || undefined,
        totalQuantity: formData.get("totalQuantity") === null || formData.get("totalQuantity") === ""
          ? undefined
          : Number(formData.get("totalQuantity")),
        imageUrl: String(formData.get("imageUrl") ?? "").trim() || undefined,
      },
      imageFile: imageFile instanceof File && imageFile.size > 0 ? imageFile : null,
    };
  }

  return {
    body: await req.json(),
    imageFile: null,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser()
  if (!user) return apiError(new UnauthorizedError())

  const { id } = await params
  const item = await prisma.inventoryItem.findUnique({ where: { id } })
  if (!item) return apiError(new NotFoundError('Item not found.'))

  return apiSuccess(item)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const { id } = await params;
  const { body, imageFile } = await parseInventoryUpdateRequest(req);
  const parsed = AdminInventoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return apiError(new NotFoundError("Item not found."));
  }

  // INVENTORY_MANAGER can only update totalQuantity and imageUrl
  if (user.role === 'INVENTORY_MANAGER') {
    const allowed = ['totalQuantity', 'imageUrl']
    const hasDisallowedField = Object.keys(parsed.data).some(
      (k) => parsed.data[k as keyof typeof parsed.data] !== undefined && !allowed.includes(k)
    )
    if (hasDisallowedField) {
      return apiError(new ForbiddenError('Inventory Managers can only update quantity and image.'))
    }
  }

  let newFileName = imageFile?.name || `${item.slug}.png`
  if (imageFile) {
    const ext = newFileName.split('.').pop()?.toLowerCase() ?? 'jpg'
    newFileName = `item-${crypto.randomUUID()}-${Date.now()}.${ext}`
  }
  const imageUrl = imageFile
    ? await uploadItemImageToDrive(Buffer.from(await imageFile.arrayBuffer()), newFileName, imageFile.type || "image/png")
    : parsed.data.imageUrl;

  let availableQty = item.availableQty;
  let quantityDelta = 0;
  if (parsed.data.totalQuantity !== undefined) {
    const fulfilled = item.totalQuantity - item.availableQty;
    if (parsed.data.totalQuantity < fulfilled) {
      return apiError(new ConflictError("TOTAL_QUANTITY_BELOW_FULFILLED"));
    }

    quantityDelta = parsed.data.totalQuantity - item.totalQuantity;
    availableQty = item.availableQty + quantityDelta;
    if (availableQty < 0) {
      return apiError(new ConflictError("AVAILABLE_QTY_NEGATIVE"));
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.inventoryItem.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(imageUrl ? { imageUrl } : {}),
        ...(parsed.data.totalQuantity !== undefined
          ? { availableQty }
          : {}),
      },
    });

    if (parsed.data.totalQuantity !== undefined && quantityDelta !== 0) {
      await tx.stockHistory.create({
        data: {
          itemId: id,
          changeType: "ADJUSTED",
          quantityDelta,
          quantityAfter: availableQty,
          changedBy: user.id,
          notes: "Admin adjustment",
        },
      });
    }

    return result;
  });

  // Fire-and-forget: delete old Drive file when image is replaced
  if (imageUrl && item.imageUrl && item.imageUrl !== imageUrl && item.imageUrl.includes('drive.google.com')) {
    const oldFileId = extractDriveFileId(item.imageUrl)
    if (oldFileId) {
      deleteFileFromDrive(oldFileId).catch(err =>
        console.error('[Drive] Background delete failed:', err)
      )
    }
  }

  await writeAuditLog({
    userId: user.id,
    action: "ITEM_UPDATED",
    entity: "InventoryItem",
    entityId: id,
    metadata: parsed.data,
  });

  return apiSuccess(updated);
}

export const dynamic = "force-dynamic";
