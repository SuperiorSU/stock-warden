import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export async function writeAuditLog(params: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? undefined,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress ?? undefined,
      userAgent: params.userAgent ?? undefined,
    },
  });
}
