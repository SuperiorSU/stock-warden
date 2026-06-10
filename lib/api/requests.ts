import { NextResponse } from "next/server";
import { ApiError } from "@/lib/errors";

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
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

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error.",
      },
    },
    { status: 500 }
  );
}
