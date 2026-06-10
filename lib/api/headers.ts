import type { NextResponse } from "next/server";

export function attachRateLimitHeaders(
  response: NextResponse,
  config: { maxRequests: number; remaining: number; resetAt: number }
) {
  response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
  response.headers.set("X-RateLimit-Remaining", String(config.remaining));
  response.headers.set("X-RateLimit-Reset", String(config.resetAt));
}
