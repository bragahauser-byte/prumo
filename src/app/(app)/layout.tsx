import { AppShell } from "@/components/layout/app-shell";
import { FinanceProvider } from "@/components/finance-provider";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims.sub) redirect("/login?next=%2Foverview");
  }

  return (
    <FinanceProvider mode={isSupabaseConfigured() ? "supabase" : "local"}>
      <AppShell>{children}</AppShell>
    </FinanceProvider>
  );
}
