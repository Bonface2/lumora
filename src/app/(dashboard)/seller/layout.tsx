import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SellerSidebar } from "@/components/layouts/SellerSidebar";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SELLER" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return (
    <DashboardLayout sidebar={<SellerSidebar />}>
      {children}
    </DashboardLayout>
  );
}
