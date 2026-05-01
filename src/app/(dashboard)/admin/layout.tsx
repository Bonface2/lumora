import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layouts/AdminSidebar";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <DashboardLayout sidebar={<AdminSidebar />}>
      {children}
    </DashboardLayout>
  );
}
