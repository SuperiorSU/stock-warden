import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  if (role === "SUPER_ADMIN") {
    redirect("/super-admin/overview");
  } else if (role === "ADMIN") {
    redirect("/admin/requests");
  } else if (role === "INVENTORY_MANAGER") {
    redirect("/inventory-manager");
  } else {
    redirect("/dashboard");
  }
}
