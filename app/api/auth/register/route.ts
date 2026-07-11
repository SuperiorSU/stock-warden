import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";

const DEPARTMENT_OPTIONS = [
  "MBA/BBA",
  "Pharmacy",
  "Hotel Management",
  "Computer Science",
  "Admission Cell",
  "BCA",
  "Paramedical",
  "Applied Sciences",
  "Super60",
  "The Unqiues",
] as const;

const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(6).max(100),
  department: z.enum(DEPARTMENT_OPTIONS),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid registration details.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { email, password, name, department } = parsed.data;

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
