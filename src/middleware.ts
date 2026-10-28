import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Exclut : fichiers statiques, icônes, manifeste, service worker, webhooks (authentifiés par signature)
    "/((?!_next/static|_next/image|icons/|logo.svg|manifest.webmanifest|sw.js|offline.html|api/webhooks/|api/cron/).*)",
  ],
};
