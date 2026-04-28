import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SellerSidebar } from "@/components/layouts/SellerSidebar";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SELLER" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SellerSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
