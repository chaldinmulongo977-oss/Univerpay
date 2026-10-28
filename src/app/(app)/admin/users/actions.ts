"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInvitationToken } from "@/server/invitations";

export type InviteState = { error?: string; link?: string };

const schema = z.object({
  email: z.string().email(),
  role_id: z.string().uuid(),
  faculty_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  days: z.coerce.number().int().min(1).max(30),
});

export async function createInvitation(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const access = await requirePermission("users.manage");     // contrôle serveur, indépendant de l'interface
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Formulaire invalide." };
  const { email, role_id, faculty_id, days } = parsed.data;

  const admin = createAdminClient();
  const { data: role } = await admin.from("roles").select("code, is_faculty_scoped").eq("id", role_id).single();
  if (!role) return { error: "Rôle inconnu." };
  if (role.is_faculty_scoped && !faculty_id) return { error: "Ce rôle exige une faculté." };

  const { token, hash } = generateInvitationToken();
  const { data: inv, error } = await admin.from("invitations").insert({
    email: email.toLowerCase(), role_id, faculty_id: role.is_faculty_scoped ? faculty_id : null,
    token_hash: hash, expires_at: new Date(Date.now() + days * 86400_000).toISOString(), invited_by: access.userId,
  }).select("id").single();
  if (error || !inv) return { error: "Création impossible." };
  await admin.from("audit_logs").insert({ actor_id: access.userId, action: "invitation.create", entity: "invitations", entity_id: inv.id, details: { role: role.code } });

  revalidatePath("/admin/users");
  return { link: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invitation?token=${token}` };
}

export async function revokeInvitation(fd: FormData) {
  const access = await requirePermission("users.manage");
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  const admin = createAdminClient();
  await admin.from("invitations").update({ status: "revoked" }).eq("id", id.data).eq("status", "pending");
  await admin.from("audit_logs").insert({ actor_id: access.userId, action: "invitation.revoke", entity: "invitations", entity_id: id.data });
  revalidatePath("/admin/users");
}
