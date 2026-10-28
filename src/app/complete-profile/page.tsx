import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/brand/field";
import { createClient } from "@/lib/supabase/server";

async function save(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const first = String(formData.get("first_name") ?? "").trim();
  const last = String(formData.get("last_name") ?? "").trim();
  if (!first || !last) redirect("/complete-profile");
  // Colonnes modifiables limitées par GRANT ; le statut est activé ici car l'identité de base est fournie.
  await supabase.from("user_profiles").update({
    first_name: first, last_name: last,
    middle_name: String(formData.get("middle_name") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
  }).eq("id", user.id);
  // Le passage à « active » est réservé au serveur (service_role) : voir fonction ci-dessous.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("user_profiles").update({ status: "active" }).eq("id", user.id).eq("status", "pending_profile");
  redirect("/dashboard");
}

export default async function CompleteProfile() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader><CardTitle className="text-xl">Finaliser mon profil</CardTitle></CardHeader>
        <CardContent>
          <form action={save} className="space-y-4">
            <Field id="last_name" label="Nom"><Input id="last_name" name="last_name" required /></Field>
            <Field id="middle_name" label="Postnom (facultatif)"><Input id="middle_name" name="middle_name" /></Field>
            <Field id="first_name" label="Prénom"><Input id="first_name" name="first_name" required /></Field>
            <Field id="phone" label="Téléphone (facultatif)"><Input id="phone" name="phone" type="tel" inputMode="tel" /></Field>
            <Button type="submit" className="w-full">Continuer</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
