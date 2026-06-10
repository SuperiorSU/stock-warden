import { NextResponse } from "next/server";
import { ApiError } from "@/lib/errors";

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, meta });
}

export function apiError(error: ApiError) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? {},
      },
    },
    { status: error.status }
  );
}
