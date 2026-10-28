import { cookies } from "next/headers";
import { getAccess } from "@/lib/permissions";

// Décide où envoyer l'utilisateur à l'ouverture, à partir de la session SERVEUR.
export async function resolveDestination(): Promise<string> {
  const access = await getAccess();
  if (access) {
    if (access.status === "suspended") return "/account-disabled";
    if (access.status === "pending_profile") return "/complete-profile";
    return "/dashboard";
  }
  const jar = await cookies();
  return jar.get("unipay_onboarded")?.value === "1" ? "/auth/login" : "/onboarding";
}
