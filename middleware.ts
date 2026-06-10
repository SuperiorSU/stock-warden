import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { ROLE_GUARDS } from "@/lib/auth/roles";

const { auth } = NextAuth(authConfig);

function resolveRequiredRoles(pathname: string) {
  return Object.entries(ROLE_GUARDS).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];
}

export default auth(async (request) => {
  const { pathname } = request.nextUrl;
  const requiredRoles = resolveRequiredRoles(pathname);

  if (requiredRoles === undefined || requiredRoles.length === 0) {
    return NextResponse.next();
  }

  const session = request.auth;
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  if (!requiredRoles.includes(session.user.role)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 }
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.user.id);
  requestHeaders.set("x-user-role", session.user.role);
  if (session.user.email) {
    requestHeaders.set("x-user-email", session.user.email);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: ["/api/:path*"],
};
