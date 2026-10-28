import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/states";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/server/invitations";

export const dynamic = "force-dynamic";

async function accept(token: string, userId: string, email: string): Promise<"ok" | "invalid" | "mismatch"> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invitations").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) return "invalid";
  if (inv.email.toLowerCase() !== email.toLowerCase()) return "mismatch";   // vérification d'identité
  const { error } = await admin.from("user_role_assignments").insert({
    user_id: userId, role_id: inv.role_id, faculty_id: inv.faculty_id, granted_by: inv.invited_by,
  });
  if (error && !error.message.includes("duplicate")) return "invalid";
  await admin.from("invitations").update({ status: "accepted", accepted_by: userId }).eq("id", inv.id);
  await admin.from("audit_logs").insert({ actor_id: userId, action: "invitation.accept", entity: "invitations", entity_id: inv.id });
  return "ok";
}

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const here = `/auth/accept-invitation?token=${encodeURIComponent(token ?? "")}`;
  if (!token) return <Card><CardContent className="pt-6"><ErrorMessage>Lien d'invitation incomplet.</ErrorMessage></CardContent></Card>;
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(here)}`);

  const result = await accept(token, user.id, user.email ?? "");
  return (
    <Card>
      <CardHeader><CardTitle className="text-xl">Invitation</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {result === "ok" ? (
          <div className="space-y-4 text-center" role="status">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
            <p className="text-sm">Invitation acceptée. Votre rôle est activé.</p>
            <Button asChild className="w-full"><Link href="/dashboard">Ouvrir mon espace</Link></Button>
          </div>
        ) : (
          <ErrorMessage>
            {result === "mismatch"
              ? "Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec l'adresse invitée."
              : "Cette invitation est invalide, expirée ou révoquée."}
          </ErrorMessage>
        )}
      </CardContent>
    </Card>
  );
}
