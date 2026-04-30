import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BuyerSidebar } from "@/components/layouts/BuyerSidebar";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <DashboardLayout sidebar={<BuyerSidebar />}>
      {children}
    </DashboardLayout>
  );
}
