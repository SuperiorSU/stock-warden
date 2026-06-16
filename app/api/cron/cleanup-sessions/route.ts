import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const deleted = await prisma.userSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return Response.json({ deleted: deleted.count });
}

export const dynamic = "force-dynamic";
