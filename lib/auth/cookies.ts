import { cookies } from "next/headers";

// Refresh token cookie — session-scoped (no maxAge/expires) so the browser
// deletes it automatically when all windows close.
export async function setRefreshTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("sw_refresh", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    path:     "/api/auth",
    // Intentionally no maxAge or expires — becomes a session cookie
  });
}

export async function clearRefreshTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set("sw_refresh", "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    path:     "/api/auth",
    maxAge:   0,
  });
}
