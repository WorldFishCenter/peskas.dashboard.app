import { ClientOnly } from "@/components/client-only";
import { SiteHeader } from "@/components/site-header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="@container/main flex flex-1 flex-col gap-4 p-4">
        <ClientOnly>{children}</ClientOnly>
      </main>
    </div>
  );
}
