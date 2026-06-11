import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { cached } from "@/lib/cache/redis";

export interface RequestUser {
  id: string;
  role: string;
  email?: string | null;
}

export async function getRequestUser(): Promise<RequestUser | null> {
  const headerStore = await headers();
  const id = headerStore.get("x-user-id");
  const headerRole = headerStore.get("x-user-role");
  const headerEmail = headerStore.get("x-user-email");

  if (!id || !headerRole) {
    return null;
  }

  try {
    // Cached 30s — eliminates one DB round-trip per API request while staying
    // responsive to deactivations and role changes within a short window.
    const dbUser = await cached(`user:auth:${id}`, 30, () =>
      prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, email: true, isActive: true },
      })
    );

    if (!dbUser || !dbUser.isActive) {
      return null;
    }

    return { id: dbUser.id, role: dbUser.role, email: dbUser.email };
  } catch {
    // DB or Redis unreachable — fall back to JWT header identity.
    return { id, role: headerRole, email: headerEmail };
  }
}
