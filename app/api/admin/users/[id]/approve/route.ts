import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getRequestUser } from "@/lib/api/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getRequestUser();
    if (!caller) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized." } },
        { status: 401 }
      );
    }
    if (!['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
      return NextResponse.json(
        { success: false, error: { message: "Only admins can approve user registrations." } },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found." } },
        { status: 404 }
      );
    }
    if (user.isApproved) {
      return NextResponse.json(
        { success: false, error: { message: "User is already approved." } },
        { status: 409 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isApproved: true },
      select: { id: true, name: true, email: true, isApproved: true }
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Approve user error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Internal server error." } },
      { status: 500 }
    );
  }
}
