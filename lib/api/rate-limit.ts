import { NextResponse } from "next/server";
import { rateLimit, RateLimitConfig } from "@/lib/rate-limit/limiter";

export async function enforceRateLimit(identifier: string, config: RateLimitConfig) {
  const result = await rateLimit(identifier, config);

  if (!result.allowed) {
    const response = NextResponse.json(
      { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." } },
      { status: 429 }
    );
    response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(result.resetAt));
    response.headers.set("Retry-After", String(config.windowSeconds));
    return response;
  }

  return null;
}
