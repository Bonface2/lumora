export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <a href="/" className="inline-flex items-center gap-2">
            <img src="/logo-light.svg" alt="Lumora" className="h-24 w-auto object-contain" />
          </a>
          <p className="mt-1 text-sm text-gray-500">Events &amp; Ticketing</p>
        </div>
        {children}
      </div>
    </div>
  );
}
