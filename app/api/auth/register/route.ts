import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, department } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: { message: "Missing required fields." } },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
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
        role: "USER",
        isApproved: false,
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true, data: { message: "Registration successful. Pending admin approval." } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Internal server error." } },
      { status: 500 }
    );
  }
}
