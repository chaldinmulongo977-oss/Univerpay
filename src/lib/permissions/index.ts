import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Access = {
  userId: string;
  email: string | null;
  status: "pending_profile" | "active" | "suspended";
  roles: { code: string; facultyId: string | null }[];
  permissions: Set<string>;
  fullName: string;
};

type AssignmentRow = {
  faculty_id: string | null;
  roles: { code: string; role_permissions: { permissions: { code: string } | null }[] } | null;
};

// Rôles et permissions viennent TOUJOURS de la base, jamais d'un paramètre d'URL ou du navigateur.
export async function getAccess(): Promise<Access | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("user_profiles").select("status, first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_role_assignments")
      .select("faculty_id, roles(code, role_permissions(permissions(code)))")
      .eq("user_id", user.id)
      .is("revoked_at", null),
  ]);

  const assignments = (rows ?? []) as unknown as AssignmentRow[];
  const permissions = new Set<string>();
  const roles = assignments
    .filter((a) => a.roles)
    .map((a) => {
      a.roles!.role_permissions.forEach((rp) => rp.permissions && permissions.add(rp.permissions.code));
      return { code: a.roles!.code, facultyId: a.faculty_id };
    });

  return {
    userId: user.id,
    email: user.email ?? null,
    status: (profile?.status as Access["status"]) ?? "pending_profile",
    roles,
    permissions,
    fullName: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email || "Utilisateur",
  };
}

export async function requireAccess(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/auth/login");
  if (access.status === "suspended") redirect("/account-disabled");
  if (access.status === "pending_profile") redirect("/complete-profile");
  return access;
}

export async function requirePermission(code: string): Promise<Access> {
  const access = await requireAccess();
  if (!access.permissions.has(code)) redirect("/403");
  return access;
}

export const hasRole = (a: Access, code: string) => a.roles.some((r) => r.code === code);
