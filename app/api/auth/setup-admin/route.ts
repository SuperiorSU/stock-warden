import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  try {
    // In production, you would want to protect this endpoint with a strong secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SETUP_SECRET || 'supersecret'}`) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized setup access." } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { email, password, name, role, department } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { success: false, error: { message: "Missing required fields." } },
        { status: 400 }
      );
    }

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: { message: "Invalid role for this endpoint." } },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { message: "Email already registered." } },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name,
        department,
        passwordHash,
        role,
        isApproved: true,
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true, data: { message: `${role} account created successfully.` } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin setup error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Internal server error." } },
      { status: 500 }
    );
  }
}
