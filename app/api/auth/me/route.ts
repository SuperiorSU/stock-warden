import { auth } from "@/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return apiError(new UnauthorizedError());
  }

  return apiSuccess({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    department: session.user.department,
  });
}

export const dynamic = "force-dynamic";
