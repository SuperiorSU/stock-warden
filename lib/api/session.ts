import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";

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
    // Rehydrate from DB to avoid stale JWT/header identity after reseed/reset.
    const dbUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        email: true,
        isActive: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return null;
    }

    return {
      id: dbUser.id,
      role: dbUser.role,
      email: dbUser.email,
    };
  } catch {
    // DB unreachable — fall back to JWT header identity.
    return { id, role: headerRole, email: headerEmail };
  }
}
