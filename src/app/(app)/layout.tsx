import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAccess();
  return (
    <AppShell
      name={access.fullName}
      permissions={[...access.permissions]}
      roles={access.roles.map((r) => r.code)}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
