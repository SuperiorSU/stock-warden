import { prisma } from "@/lib/db/prisma";
import { getRedis } from "@/lib/cache/redis";
import { sendRequestApprovedEmail } from "@/lib/notifications/emails";

interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  requestId?: string;
  sendEmail?: boolean;
  emailTo?: string | null;
  emailData?: {
    invoiceNumber: string;
    recipientName: string;
    downloadUrl: string;
  };
}

export async function dispatch(payload: NotificationPayload) {
  await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type as any,
      title: payload.title,
      message: payload.message,
      requestId: payload.requestId,
      emailSent: false,
    },
  });

  const client = await getRedis();
  await client.publish(
    `notifications:${payload.userId}`,
    JSON.stringify({
      type: payload.type,
      title: payload.title,
      message: payload.message,
    })
  );

  if (payload.sendEmail && payload.emailTo && payload.emailData) {
    try {
      await sendRequestApprovedEmail(payload.emailTo, payload.emailData);
      await prisma.notification.updateMany({
        where: {
          userId: payload.userId,
          type: payload.type as any,
          requestId: payload.requestId ?? undefined,
        },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
    } catch {
      // Email failures should not block API flow.
    }
  }
}

export async function dispatchToAdmins(payload: Omit<NotificationPayload, "userId">) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, email: true, name: true },
  });

  await Promise.all(
    admins.map((admin) =>
      dispatch({
        ...payload,
        userId: admin.id,
        emailTo: admin.email,
        emailData: payload.emailData
          ? {
              ...payload.emailData,
              recipientName: admin.name,
            }
          : undefined,
      })
    )
  );
}

export async function dispatchToInventoryManagers(payload: Omit<NotificationPayload, "userId">) {
  const inventoryManagers = await prisma.user.findMany({
    where: { role: "INVENTORY_MANAGER", isActive: true },
    select: { id: true, email: true, name: true },
  });

  await Promise.all(
    inventoryManagers.map((manager) =>
      dispatch({
        ...payload,
        userId: manager.id,
        emailTo: manager.email,
        emailData: payload.emailData
          ? {
              ...payload.emailData,
              recipientName: manager.name,
            }
          : undefined,
      })
    )
  );
}
