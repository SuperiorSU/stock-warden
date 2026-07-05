import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRequestUser } from "@/lib/api/session";
import {
  ApiError,
  ConflictCodeError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { CreateRequestSchema } from "@/lib/validation/requests";
import { UserRequestFilterSchema } from "@/lib/validation/user";
import { paginateWithCursor } from "@/lib/pagination/cursor";
import { decodeCursor, encodeCursor } from "@/lib/pagination/secure-cursor";
import { buildRequestSignature } from "@/lib/requests/signature";
import { dispatchToAdmins } from "@/lib/notifications/dispatcher";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit/config";
import { parseIsoDate } from "@/lib/utils/date";
import { getCurrentSessionYear } from "@/lib/utils/session-year";

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const url = new URL(req.url);
  const parsed = UserRequestFilterSchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    sessionYear: url.searchParams.get("sessionYear") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(new ValidationError("Invalid query parameters.", parsed.error.flatten()));
  }

  const { status, sessionYear, cursor, limit = 20, dateFrom, dateTo } = parsed.data;
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
    userId: user.id,
    ...(status ? { status } : {}),
    ...(sessionYear ? { sessionYear } : {}),
  };

  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const page = await paginateWithCursor(
    (args) =>
      prisma.request.findMany({
        where,
        take: args.take,
        cursor: args.cursor,
        skip: args.skip,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              item: { select: { name: true, unit: true } },
            },
          },
        },
      }),
    () => prisma.request.count({ where }),
    { cursor: decodedCursor?.id, limit }
  );

  const lastItem = page.items[page.items.length - 1] as
    | { id: string; createdAt: Date }
    | undefined;
  const nextCursor = lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

  return apiSuccess(page.items, {
    limit,
    total: page.total,
    hasMore: page.hasMore,
    nextCursor,
  });
}

export async function POST(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return apiError(new UnauthorizedError());
  }

  const rateLimit = await enforceRateLimit(user.id, RATE_LIMITS.CREATE_REQUEST);
  if (rateLimit) {
    return rateLimit;
  }

  const body = await req.json();
  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(new ValidationError("Invalid payload.", parsed.error.flatten()));
  }

  const sessionYear = getCurrentSessionYear();

  const items = parsed.data.items;
  const itemIds = items.map((item) => item.itemId);
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, isActive: true, isStale: false, sessionYear },
  });

  if (inventoryItems.length !== items.length) {
    return apiError(new ValidationError("Some items are unavailable."));
  }

  const insufficient = inventoryItems
    .map((item) => {
      const requested = items.find((i) => i.itemId === item.id);
      if (!requested || item.availableQty < requested.quantity) {
        return { name: item.name, available: item.availableQty };
      }
      return null;
    })
    .filter(Boolean);

  if (insufficient.length > 0) {
    return apiError(
      new ConflictCodeError("INSUFFICIENT_STOCK", "Insufficient stock.", {
        items: insufficient,
      })
    );
  }

  const openRequests = await prisma.request.findMany({
    where: {
      userId: user.id,
      sessionYear,
      status: { in: ["REQUESTED", "PENDING"] },
    },
    include: { items: true },
  });

  const signature = buildRequestSignature(items);
  const duplicate = openRequests.find((request) => {
    const requestSignature = buildRequestSignature(
      request.items.map((item) => ({ itemId: item.itemId, quantity: item.quantityReq }))
    );
    return requestSignature === signature;
  });

  if (duplicate) {
    return apiError(
      new ConflictCodeError("DUPLICATE_OPEN_REQUEST", "Duplicate open request.")
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.request.create({
      data: {
        userId: user.id,
        status: "REQUESTED",
        notes: parsed.data.notes,
        sessionYear,
      },
    });

    await tx.requestItem.createMany({
      data: items.map((item) => ({
        requestId: request.id,
        itemId: item.itemId,
        quantityReq: item.quantity,
      })),
    });

    await tx.requestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: null,
        toStatus: "REQUESTED",
        changedBy: user.id,
      },
    });

    return request;
  });

  await dispatchToAdmins({
    type: "REQUEST_CREATED",
    title: "New request",
    message: `New request submitted by ${user.email ?? "user"}.`,
    requestId: created.id,
    sendEmail: true,
  });

  return apiSuccess(created);
}

export const dynamic = "force-dynamic";
