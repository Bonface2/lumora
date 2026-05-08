import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata = { title: "Profile" };

export default async function SellerProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, oauthAccount] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true, role: true, createdAt: true },
    }),
    db.account.findFirst({
      where: { userId: session.user.id, provider: "google" },
      select: { id: true },
    }),
  ]);

  if (!user) redirect("/login");

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your personal details.</p>
        </div>
        <ProfileForm
          user={{
            name: user.name,
            email: user.email!,
            phone: user.phone,
            role: user.role,
            provider: oauthAccount ? "google" : "credentials",
            createdAt: user.createdAt,
          }}
        />
      </div>
    </div>
  );
}
