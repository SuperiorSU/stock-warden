import { getRedis } from "@/lib/cache/redis";
import { getRequestUser } from "@/lib/api/session";

export async function GET(req: Request) {
  const user = await getRequestUser();
  if (!user) {
    return new Response(null, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const baseClient = await getRedis();
      const subscriber = baseClient.duplicate();
      await subscriber.connect();

      await subscriber.subscribe(`notifications:${user.id}`, (message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
      });

      req.signal.addEventListener("abort", () => {
        void subscriber.unsubscribe(`notifications:${user.id}`);
        void subscriber.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const dynamic = "force-dynamic";
