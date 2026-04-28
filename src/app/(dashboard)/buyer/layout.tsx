import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BuyerSidebar } from "@/components/layouts/BuyerSidebar";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen bg-gray-50">
      <BuyerSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
