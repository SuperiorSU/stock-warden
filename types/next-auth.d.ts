import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      department?: string | null;
    };
  }

  interface User {
    role?: string;
    department?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    department?: string | null;
  }
}
