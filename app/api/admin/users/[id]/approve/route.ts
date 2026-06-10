import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found." } },
        { status: 404 }
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
