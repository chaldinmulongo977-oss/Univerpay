import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { revokeInvitation } from "./actions";

export const metadata = { title: "Utilisateurs et invitations" };

export default async function UsersPage() {
  await requirePermission("users.manage");
  const supabase = await createClient();
  const [{ data: roles }, { data: faculties }, { data: invitations }] = await Promise.all([
    supabase.from("roles").select("id, label, is_faculty_scoped").neq("code", "student").order("label"),
    supabase.from("faculties").select("id, name").order("name"),
    supabase.from("invitations").select("id, email, status, expires_at, roles(label)").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Utilisateurs et invitations</h1>
      <Card>
        <CardHeader><CardTitle>Inviter un utilisateur</CardTitle></CardHeader>
        <CardContent>
          <InviteForm
            roles={(roles ?? []).map((r) => ({ id: r.id, label: r.label, scoped: r.is_faculty_scoped }))}
            faculties={(faculties ?? []).map((f) => ({ id: f.id, label: f.name }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Invitations récentes</CardTitle></CardHeader>
        <CardContent>
          {!invitations?.length ? <EmptyState title="Aucune invitation" /> : (
            <ul className="divide-y">
              {invitations.map((i) => {
                const expired = i.status === "pending" && new Date(i.expires_at) < new Date();
                const role = Array.isArray(i.roles) ? i.roles[0] : i.roles;
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div><p className="font-medium">{i.email}</p><p className="text-muted-foreground">{(role as { label: string } | null)?.label}</p></div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(expired ? "expired" : i.status)}>{expired ? "expirée" : i.status}</Badge>
                      {i.status === "pending" && !expired && (
                        <form action={revokeInvitation}><input type="hidden" name="id" value={i.id} /><Button size="sm" variant="outline" type="submit">Révoquer</Button></form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
