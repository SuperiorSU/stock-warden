import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString();

        if (!email || !password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            throw new Error("Invalid credentials.");
          }

          if (!user.isActive) {
            throw new Error("Account is inactive. Please contact admin.");
          }

          if (!user.isApproved) {
            throw new Error("Account is pending admin approval.");
          }

          const isValid = await verifyPassword(user.passwordHash, password);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
          };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientInitializationError) {
            throw new Error("Authentication service is temporarily unavailable. Please try again later.");
          }

          if (error instanceof Error && error.message.includes("Can't reach database server")) {
            throw new Error("Authentication service is temporarily unavailable. Please try again later.");
          }

          throw error;
        }
      },
    }),
  ],
});
